"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart as RechartsBarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import ReactMarkdown from "react-markdown";
import { 
  MessageSquare, Loader2, Send, Activity, 
  Map, ShieldAlert, Settings, Server,
  Bell, UserCircle, ActivitySquare, AlertTriangle, Layers, Sun, Moon, X, Maximize, Minimize, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Download, Table as TableIcon
} from "lucide-react";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");
  const [model, setModel] = useState("nvidia");
  const [dataSource, setDataSource] = useState("servicenow");
  const [isExpanded, setIsExpanded] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line' | 'table'>('bar');
  const [serviceNowUrl, setServiceNowUrl] = useState<string>("");
  
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Drill-through states
  const [isDrilling, setIsDrilling] = useState(false);
  const [drilldownData, setDrilldownData] = useState<any>(null);
  const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);

  const isDark = theme === "dark";

  const handleQuery = async () => {
    if (!query) return;
    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const res = await fetch("http://localhost:8001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, model, data_source: dataSource }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch response from server");
      }

      setResponse(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
      setIsDrilling(false);
      setDrilldownData(null);
    }
  };

  const handleBarClick = async (data: any) => {
    if (!response || !response.query_args) return;
    
    setIsDrilldownLoading(true);
    setIsDrilling(true);
    
    try {
      // Find what we grouped by
      const sample = response.result_data[0];
      const keys = Object.keys(sample);
      const groupByField = keys[0]; // e.g., 'assignment_group'
      
      let groupByValue = data[groupByField]; 
      // If clicked from a Line chart activeDot, data is nested in payload
      if (data.payload && data.payload[groupByField] !== undefined) {
        groupByValue = data.payload[groupByField];
      }
      
      // Combine original args with the specific clicked value
      const drillArgs = { ...response.query_args };
      drillArgs[groupByField] = groupByValue;
      
      const res = await fetch("http://localhost:8001/api/drilldown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_args: drillArgs, data_source: dataSource }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setDrilldownData(data);
      } else {
        console.error("Drilldown failed");
        setIsDrilling(false);
      }
    } catch (err) {
      console.error(err);
      setIsDrilling(false);
    } finally {
      setIsDrilldownLoading(false);
    }
  };

  const handleAutoChartClick = (data: any) => {
    if (!response || !response.result_data) return;
    
    setIsDrilldownLoading(true);
    setIsDrilling(true);
    
    const clickName = data?.name || data?.activeLabel || data?.payload?.name || data;
    
    setTimeout(() => {
      const filtered = response.result_data.filter((row: any) => 
        (row.assignment_group || row.state || 'Unknown') === clickName
      );
      setDrilldownData(filtered);
      setIsDrilldownLoading(false);
    }, 300);
  };

  const [kpiData, setKpiData] = useState<any>({
    open_incidents: "-",
    critical_incidents: "-",
    avg_mttr: "-",
    unassigned_incidents: "-",
    sla_breaches: "-"
  });

  // Fetch KPIs on component mount
  
  const fetchGlobalKpis = async () => {
    try {
      const res = await fetch("http://localhost:8001/api/kpis?source=" + dataSource);
      if (res.ok) {
        const data = await res.json();
        setKpiData(data);
      }
    } catch (err) {
      console.error("Failed to fetch KPIs:", err);
    }
  };

  useEffect(() => {
    fetchGlobalKpis();
    
    // Fetch dynamic ServiceNow URL from backend config
    const fetchConfig = async () => {
      try {
        const res = await fetch("http://localhost:8001/api/config");
        if (res.ok) {
          const data = await res.json();
          if (data.servicenow_instance_url) {
            setServiceNowUrl(data.servicenow_instance_url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch config:", err);
      }
    };
    fetchConfig();
  }, [dataSource]);

  useEffect(() => {
    if (response && response.query_args) {
      const fetchDynamicKpis = async () => {
        try {
          const res = await fetch("http://localhost:8001/api/kpis/dynamic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query_args: response.query_args, data_source: dataSource })
          });
          if (res.ok) {
            const data = await res.json();
            setKpiData(data);
          }
        } catch (err) {
          console.error("Failed to fetch dynamic KPIs:", err);
        }
      };
      fetchDynamicKpis();
    } else if (response === null) {
      fetchGlobalKpis();
    }
  }, [response, dataSource]);

  const handleExportPDF = async () => {
    if (!response) return;
    
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Title
      doc.setFontSize(20);
      doc.setTextColor(2, 132, 199);
      doc.text("AI Incident Analysis Report", 14, 22);
      
      // Meta info
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
      
      // Prompt
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text("Prompt:", 14, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(query || "", 35, 42);
      
      // KPIs Visual Capture using Native jsPDF
      let currentY = 55;
      
      if (kpiData) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Key Performance Indicators", 14, currentY);
        currentY += 8;
        
        const kpiValues = [
          { label: 'OPEN INCIDENTS', value: String(kpiData.open_incidents), color: [14, 165, 233] },
          { label: 'CRITICAL (P1)', value: String(kpiData.critical_incidents), color: [244, 63, 94] },
          { label: 'AVG MTTR', value: String(kpiData.avg_mttr), color: [16, 185, 129] },
          { label: 'UNASSIGNED', value: String(kpiData.unassigned_incidents), color: [139, 92, 246] },
          { label: 'SLA BREACHES', value: String(kpiData.sla_breaches), color: [217, 70, 239] }
        ];
        
        const cardWidth = 35;
        const cardHeight = 22;
        let startX = 14;
        
        for (const kpi of kpiValues) {
          // Draw Card Background
          doc.setFillColor(248, 250, 252); // slate-50
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.roundedRect(startX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
          
          // Draw Top Accent Line
          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.roundedRect(startX, currentY, cardWidth, 1.5, 1.5, 1.5, 'F');
          
          // Draw Label
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.setFont('helvetica', 'bold');
          doc.text(kpi.label, startX + (cardWidth/2), currentY + 8, { align: 'center' });
          
          // Draw Value
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42); // slate-900
          doc.setFont('helvetica', 'bold');
          doc.text(kpi.value, startX + (cardWidth/2), currentY + 17, { align: 'center' });
          
          startX += cardWidth + 3.5;
        }
        
        currentY += cardHeight + 15;
      }
      
      // AI Summary using autoTable for perfect pagination
      const cleanText = response.natural_language_response.replace(/\*\*/g, '');
      
      autoTable(doc, {
        startY: currentY,
        head: [[`AI Summary (Generated by: ${response.model_used || model})`]],
        body: [[cleanText]],
        theme: 'plain',
        styles: { fontSize: 11 },
        headStyles: { fontSize: 14, fontStyle: 'bold', textColor: [0,0,0], cellPadding: { bottom: 5, top: 0, left: 0 } },
        bodyStyles: { textColor: [50, 50, 50], cellPadding: { left: 0, right: 0 } },
        margin: { left: 14, right: 14 }
      });
      
      let nextY = (doc as any).lastAutoTable.finalY + 15;
      
      // Capture All Charts
      const chartIds = [
        { id: 'pdf-export-bar', title: 'Bar Chart Visualization' },
        { id: 'pdf-export-pie', title: 'Pie Chart Visualization' },
        { id: 'pdf-export-line', title: 'Line Chart Visualization' }
      ];
      
      for (const chart of chartIds) {
        const chartEl = document.getElementById(chart.id);
        if (chartEl) {
          try {
            const svgElement = chartEl.querySelector('svg');
            if (svgElement) {
              const clone = svgElement.cloneNode(true) as SVGSVGElement;
              const rect = svgElement.getBoundingClientRect();
              clone.setAttribute('width', rect.width.toString());
              clone.setAttribute('height', rect.height.toString());
              
              const serializer = new XMLSerializer();
              const svgString = serializer.serializeToString(clone);
              const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
              const url = URL.createObjectURL(svgBlob);
              
              const img = new window.Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
              });
              
              const canvas = document.createElement('canvas');
              canvas.width = rect.width * 2;
              canvas.height = rect.height * 2;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = isDark ? '#111827' : '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 140; // Reduced size for charts
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                if (nextY + imgHeight > 280) {
                  doc.addPage();
                  nextY = 20;
                }
                
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(chart.title, 14, nextY);
                
                // Center the reduced chart
                const xOffset = (210 - imgWidth) / 2;
                doc.addImage(imgData, 'PNG', xOffset, nextY + 5, imgWidth, imgHeight);
                nextY = nextY + imgHeight + 15;
              }
              URL.revokeObjectURL(url);
            }
          } catch (e) {
            console.error(`Failed to capture ${chart.id} for PDF`, e);
          }
        }
      }
      
      // Data Table
      if (response.result_data && response.result_data.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Data Results", 14, nextY);
        
        const keys = Object.keys(response.result_data[0]);
        const head = [keys.map(k => k.replace(/_/g, ' ').toUpperCase())];
        const body = response.result_data.map((row: any) => keys.map(k => String(row[k])));
        
        const numberIndex = keys.indexOf('number');
        
        autoTable(doc, {
          startY: nextY + 5,
          head: head,
          body: body,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [2, 132, 199] },
          alternateRowStyles: { fillColor: [240, 249, 255] },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === numberIndex && dataSource === 'servicenow') {
              const sysId = response.result_data[data.row.index]['sys_id'];
              if (sysId) {
                data.cell.styles.textColor = [6, 182, 212]; // cyan-500
              }
            }
          },
          didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === numberIndex && dataSource === 'servicenow') {
              const sysId = response.result_data[data.row.index]['sys_id'];
              if (sysId) {
                const url = `${serviceNowUrl}/nav_to.do?uri=incident.do?sys_id=${sysId}`;
                doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: url });
              }
            }
          }
        });
      }
      
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      doc.save(`Incident_Analytics_Report_${dateStr}_${timeStr}.pdf`);
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      setError("Failed to generate PDF report: " + (err.message || "Unknown error"));
    }
  };

  const kpis = [
    { label: "OPEN INCIDENTS", value: kpiData.open_incidents, color: "from-blue-500 to-cyan-500", icon: Activity, description: "Total number of incidents currently active and not yet resolved." },
    { label: "CRITICAL (P1)", value: kpiData.critical_incidents, color: "from-red-500 to-orange-500", icon: AlertTriangle, description: "Priority 1 incidents causing severe business impact or outages." },
    { label: "AVG MTTR", value: kpiData.avg_mttr, color: "from-emerald-500 to-teal-500", icon: ActivitySquare, description: "Mean Time To Resolution: Average hours taken to fix issues." },
    { label: "UNASSIGNED", value: kpiData.unassigned_incidents, color: "from-purple-500 to-indigo-500", icon: Bell, description: "Tickets that have not been assigned to a resolver group yet." },
    { label: "SLA BREACHES", value: kpiData.sla_breaches, color: "from-fuchsia-500 to-pink-500", icon: ShieldAlert, description: "Incidents that have exceeded their agreed resolution timeframe." },
  ];

  return (
    <div className={`h-screen w-full font-sans overflow-hidden flex flex-col transition-colors duration-500 ${isDark ? "bg-[#090E17] text-slate-200 selection:bg-cyan-500/30" : "bg-[#E0F2FE] text-slate-800 selection:bg-blue-500/20"}`}>
      
      {/* Subtle Ambient Glows for Modern Feel */}
      <div className={`fixed top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none transition-opacity ${isDark ? 'bg-cyan-900/10' : 'bg-cyan-400/5'}`}></div>
      <div className={`fixed bottom-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[150px] pointer-events-none transition-opacity ${isDark ? 'bg-indigo-900/10' : 'bg-indigo-400/5'}`}></div>

      {/* Floating Top Nav */}
      <header className="fixed top-4 left-4 right-4 z-50 flex-none">
        <div className={`max-w-7xl mx-auto h-14 rounded-full backdrop-blur-2xl border shadow-lg flex items-center justify-between px-6 transition-colors duration-300 ${isDark ? 'bg-[#111827]/60 border-white/5 shadow-black/50' : 'bg-white/80 border-slate-200 shadow-slate-200/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${isDark ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 shadow-cyan-500/20' : 'bg-gradient-to-tr from-cyan-500 to-blue-500 shadow-cyan-500/30'}`}>
              <Activity className="w-4 h-4 text-white" />
            </div>
            <h1 className={`text-lg font-bold tracking-wide bg-clip-text text-transparent ${isDark ? 'bg-gradient-to-r from-white to-slate-400' : 'bg-gradient-to-r from-slate-900 to-slate-600'}`}>
              Natural Language Incident Analytics and Reporting
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {error && (
              <span className="text-red-500 text-xs font-medium mr-2">{error}</span>
            )}
            
            {/* Export PDF Button */}
            <button 
              onClick={handleExportPDF}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all border shadow-sm ${isDark ? 'bg-white/5 border-white/5 text-slate-300 hover:text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>

            {/* Data Source Toggle */}
            <div className={`flex items-center rounded-full p-1 border backdrop-blur-md transition-colors mr-2 ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-100/50 border-slate-200'}`}>
              <button 
                onClick={() => {
                  setDataSource("servicenow");
                  setResponse(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-full transition-all ${dataSource === 'servicenow' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-md' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
              >
                <Server className="w-3.5 h-3.5" />
                ServiceNow
              </button>
              <button 
                onClick={() => {
                  setDataSource("sqlite");
                  setResponse(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-full transition-all ${dataSource === 'sqlite' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-md' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                SQLite
              </button>
            </div>

            {/* Model Selector Toggle */}
            <div className={`flex items-center rounded-full p-1 border backdrop-blur-md transition-colors ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-100/50 border-slate-200'}`}>
              <button 
                onClick={() => setModel("nvidia")}
                className={`px-4 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-full transition-all ${model === 'nvidia' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
              >
                NVIDIA
              </button>
              <button 
                onClick={() => setModel("gemini")}
                className={`px-4 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-full transition-all ${model === 'gemini' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
              >
                Gemini
              </button>
            </div>
            
            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`p-2 rounded-full transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5' : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main ref={dashboardRef} className="flex-1 pt-24 pb-6 px-4 max-w-7xl mx-auto w-full relative z-10 flex flex-col overflow-hidden min-h-0">
        
        {/* KPI Grid */}
        <div id="pdf-export-kpis" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3 flex-none relative z-50">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="group relative">
              
              {/* Hover Tooltip */}
              <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[100] w-56 p-3 text-[11px] leading-relaxed rounded-xl shadow-2xl text-center transform scale-95 group-hover:scale-100 border backdrop-blur-xl ${isDark ? 'bg-[#1E293B]/90 text-slate-200 border-white/10 shadow-black/50' : 'bg-slate-800/95 text-slate-100 border-slate-700 shadow-slate-300'}`}>
                {kpi.description}
                <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-t border-l ${isDark ? 'bg-[#1E293B] border-white/10' : 'bg-slate-800 border-slate-700'}`}></div>
              </div>

              {/* Modern KPI Card */}
              <div className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl border backdrop-blur-md overflow-hidden transition-all duration-500 hover:-translate-y-1 ${isDark ? 'bg-gradient-to-b from-[#162032]/80 to-[#0F172A]/80 border-white/5 hover:border-cyan-500/30 hover:shadow-[0_8px_30px_rgba(6,182,212,0.1)]' : 'bg-white border-slate-200 shadow-sm hover:shadow-xl hover:border-cyan-400/40'}`}>
                <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${kpi.color} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                
                <div className="flex items-center gap-2 mb-1.5">
                  <kpi.icon className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span className={`text-[8px] font-bold tracking-widest uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {kpi.label}
                  </span>
                </div>
                <div className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {kpi.value}
                </div>
              </div>
              
            </div>
          ))}
        </div>

        {/* Search Bar - Modern Floating Pill */}
        <div className="mb-3 max-w-3xl mx-auto w-full relative flex-none">
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition duration-1000"></div>
          <div className={`relative rounded-full flex items-center p-1 shadow-2xl border backdrop-blur-xl transition-colors ${isDark ? 'bg-[#111827]/80 border-white/10 focus-within:border-cyan-500/50 focus-within:bg-[#111827]' : 'bg-white/90 border-slate-300 focus-within:border-cyan-500/50'}`}>
            <input
              type="text"
              className={`flex-1 text-sm px-5 py-2 bg-transparent border-none focus:outline-none focus:ring-0 ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
              placeholder="Ask anything about your incidents..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value === "") setResponse(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
            />
            {query && (
              <button 
                onClick={() => {
                  setQuery("");
                  setResponse(null);
                }}
                className={`p-1.5 mr-2 rounded-full transition-all flex-none ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleQuery}
              disabled={loading || !query}
              className={`mr-1 px-6 py-2.5 text-sm font-bold uppercase tracking-wider rounded-full transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'}`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
              Analyze
            </button>
          </div>
          
          {/* Popular Prompts */}
          {!loading && !response && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {[
                "Show me the top 5 critical incidents",
                "Which assignment groups have the most open tickets?",
                "What is the average MTTR for the Cloud Ops team?",
                "Show me all incidents related to AWS outages",
                "Find incidents related to VPN"
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(prompt)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors ${
                    isDark 
                      ? 'border-white/10 bg-white/5 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/10' 
                      : 'border-slate-200 bg-white/50 text-slate-500 hover:text-cyan-600 hover:border-cyan-400 hover:bg-cyan-50'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Area */}
        {response && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 min-h-0">
            
            {/* Main Visual - Data Table / Chart */}
            <div className={`${isExpanded ? 'lg:col-span-3 p-8 shadow-xl' : 'lg:col-span-2 p-6 shadow-sm'} min-h-0 rounded-lg border flex flex-col ${isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'} transition-all duration-300`}>
              <div className="flex items-center justify-between mb-6 flex-none border-b pb-4 border-slate-800/50 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {isDrilling && (
                    <button 
                      onClick={() => { setIsDrilling(false); setDrilldownData(null); }}
                      className={`p-1.5 rounded hover:bg-slate-500/10 transition-colors ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                      title="Back to Chart"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                  )}
                  <h2 className={`text-sm font-semibold tracking-wide uppercase ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isDrilling ? 'Drill-Through Detail' : 'Insight Visualization'}
                  </h2>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Chart Toggles (Always show them, even for raw data!) */}
                  {!isDrilling && response.result_data && response.result_data.length > 0 && (
                    <div className={`flex items-center rounded-full p-1 border transition-colors ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                      <button onClick={() => setChartType('bar')} className={`p-1.5 rounded-full transition-all ${chartType === 'bar' ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`} title="Bar Chart">
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setChartType('pie')} className={`p-1.5 rounded-full transition-all ${chartType === 'pie' ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`} title="Pie Chart">
                        <PieChartIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setChartType('line')} className={`p-1.5 rounded-full transition-all ${chartType === 'line' ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`} title="Line Chart">
                        <LineChartIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setChartType('table')} 
                        className={`p-1.5 rounded-full transition-all ${chartType === 'table' ? (isDark ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
                        title="Table View"
                      >
                        <TableIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)} 
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 min-h-0 relative">
                {isDrilldownLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                  </div>
                ) : isDrilling && drilldownData ? (
                  <div className="absolute inset-0 overflow-auto custom-scrollbar pr-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr>
                          {Object.keys(drilldownData[0] || {}).filter(k => k !== 'sys_id').map((key) => (
                            <th key={key} className={`py-3 px-4 font-semibold text-xs tracking-wider uppercase border-b ${isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200'}`}>
                              {key.replace('_', ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {drilldownData.map((row: any, i: number) => (
                          <tr key={i} className={`group transition-colors ${isDark ? 'hover:bg-slate-800/50 border-b border-slate-800/50' : 'hover:bg-slate-50 border-b border-slate-100'}`}>
                            {Object.keys(row).filter(k => k !== 'sys_id').map(key => (
                              <td key={key} className={`py-3 px-4 text-sm whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {key === 'number' && dataSource === 'servicenow' && row['sys_id'] ? (
                                  <a 
                                    href={`${serviceNowUrl}/nav_to.do?uri=incident.do?sys_id=${row['sys_id']}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-cyan-500 hover:text-cyan-400 hover:underline transition-colors"
                                  >
                                    {row[key]}
                                  </a>
                                ) : (
                                  row[key]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : response.result_data && response.result_data.length > 0 ? (
                  (() => {
                    const sample = response.result_data[0];
                    const isNumeric = Object.values(sample).some(val => typeof val === 'number');
                    const keys = Object.keys(sample);

                    if (isNumeric) {
                      const COLORS = ["#0ea5e9", "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#f43f5e"];
                      
                      return (
                        <div className="absolute inset-0 pb-6">
                          {chartType === 'table' ? (
                            <div className="h-full w-full overflow-auto custom-scrollbar pr-2">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr>
                                    {keys.map((k) => (
                                      <th key={k} className="p-3 border-b border-slate-700 font-semibold text-slate-300 bg-slate-800/50 sticky top-0">{k.replace(/_/g, ' ').toUpperCase()}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {response.result_data.map((row: any, i: number) => (
                                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                      {keys.map((k) => (
                                        <td key={k} className="p-3 text-slate-400">{row[k]}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="h-full w-full" id="exportable-chart">
                              <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'pie' ? (
                              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <Pie 
                                  data={response.result_data} 
                                  dataKey={keys[1]} 
                                  nameKey={keys[0]} 
                                  cx="50%" 
                                  cy="50%" 
                                  outerRadius="60%"
                                  label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                                  onClick={handleBarClick}
                                  cursor="pointer"
                                >
                                  {response.result_data.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: isDark ? '#1E293B' : '#ffffff', 
                                    borderRadius: '8px', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    color: isDark ? '#f8fafc' : '#0f172a'
                                  }}
                                />
                              </PieChart>
                            ) : chartType === 'line' ? (
                              <LineChart data={response.result_data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                <XAxis dataKey={keys[0]} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} dx={-10} domain={[0, 'auto']} />
                                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1E293B' : '#ffffff', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, color: isDark ? '#f8fafc' : '#0f172a' }} />
                                {keys.slice(1).map((key, index) => (
                                  <Line 
                                    key={key} 
                                    type="monotone" 
                                    dataKey={key} 
                                    stroke={COLORS[index % COLORS.length]} 
                                    strokeWidth={3}
                                    activeDot={{ r: 8, onClick: handleBarClick }}
                                    cursor="pointer"
                                  />
                                ))}
                              </LineChart>
                            ) : (
                              <RechartsBarChart data={response.result_data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                <XAxis 
                                  dataKey={keys[0]} 
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}
                                  angle={-45}
                                  textAnchor="end"
                                  height={60}
                                />
                                <YAxis 
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}
                                  dx={-10}
                                  domain={[0, 'auto']}
                                />
                                <Tooltip 
                                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                                  contentStyle={{ 
                                    backgroundColor: isDark ? '#1E293B' : '#ffffff', 
                                    borderRadius: '8px', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    color: isDark ? '#f8fafc' : '#0f172a'
                                  }}
                                />
                                {keys.slice(1).map((key, index) => (
                                    <Bar 
                                      key={key} 
                                      dataKey={key} 
                                      fill={COLORS[index % COLORS.length]} 
                                      radius={[4, 4, 0, 0]} 
                                      maxBarSize={40}
                                      onClick={handleBarClick}
                                      cursor="pointer"
                                    />
                                  ))
                                }
                              </RechartsBarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  );
                } else {
                      // Automatically group raw tickets for visuals
                      const counts: Record<string, number> = {};
                      response.result_data.forEach((row: any) => {
                        const group = (row.assignment_group && row.assignment_group.trim() !== '') 
                                      ? row.assignment_group 
                                      : 'Unassigned';
                        counts[group] = (counts[group] || 0) + 1;
                      });
                      const autoChartData = Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
                      const COLORS = ["#0ea5e9", "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#f43f5e"];

                      return (
                        <div className="absolute inset-0 pb-6 pr-2">
                          {chartType === 'table' ? (
                            <div className="h-full w-full overflow-auto custom-scrollbar">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr>
                                    {keys.map((key) => (
                                      <th key={key} className={`py-3 px-4 font-semibold text-xs tracking-wider uppercase border-b ${isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200'}`}>
                                        {key.replace('_', ' ')}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {response.result_data.map((row: any, i: number) => (
                                    <tr key={i} className={`group transition-colors ${isDark ? 'hover:bg-slate-800/50 border-b border-slate-800/50' : 'hover:bg-slate-50 border-b border-slate-100'}`}>
                                      {keys.map((key) => (
                                        <td key={key} className={`py-3 px-4 text-sm whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                          {key === 'number' && dataSource === 'servicenow' && row['sys_id'] ? (
                                            <a 
                                              href={`${serviceNowUrl}/nav_to.do?uri=incident.do?sys_id=${row['sys_id']}`} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-cyan-500 hover:text-cyan-400 hover:underline transition-colors"
                                            >
                                              {row[key]}
                                            </a>
                                          ) : (
                                            row[key]
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="h-full w-full" id="exportable-chart">
                              <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'pie' ? (
                                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                  <Pie data={autoChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius="60%" label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`} onClick={handleAutoChartClick} cursor="pointer">
                                    {autoChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip contentStyle={{ backgroundColor: isDark ? '#1E293B' : '#ffffff', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, color: isDark ? '#f8fafc' : '#0f172a' }} />
                                </PieChart>
                              ) : chartType === 'line' ? (
                                <LineChart data={autoChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} dx={-10} domain={[0, 'auto']} />
                                  <Tooltip contentStyle={{ backgroundColor: isDark ? '#1E293B' : '#ffffff', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, color: isDark ? '#f8fafc' : '#0f172a' }} />
                                  <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={3} activeDot={{ r: 8, onClick: handleAutoChartClick }} cursor="pointer" />
                                </LineChart>
                              ) : (
                                <RechartsBarChart data={autoChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} dx={-10} domain={[0, 'auto']} />
                                  <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: isDark ? '#1E293B' : '#ffffff', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, color: isDark ? '#f8fafc' : '#0f172a' }} />
                                  <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} onClick={handleAutoChartClick} cursor="pointer" />
                                </RechartsBarChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                          )}
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className={`h-full flex items-center justify-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    No visualization available for this dataset.
                  </div>
                )}
              </div>
            </div>

            {/* AI Assistant Panel */}
            {!isExpanded && (
              <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
                
                {/* Synthesis mimicking the forensic summary */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className={`pl-4 border-l-4 py-2 flex-1 flex flex-col min-h-0 transition-colors ${isDark ? 'border-cyan-500' : 'border-cyan-600'}`}>
                    <div className={`text-sm italic mb-3 font-medium flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      AI Incident Analysis (Generated by: {response.model_used || (model === 'nvidia' ? 'llama-3.2-11b' : 'gemini-3.5')})
                    </div>
                    <div className={`text-[15px] leading-relaxed flex-1 overflow-y-auto custom-scrollbar pr-2 markdown-container ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      <style dangerouslySetInnerHTML={{__html: `
                        .markdown-container p { margin-bottom: 0.75rem; }
                        .markdown-container strong { font-weight: 700; color: ${isDark ? '#38bdf8' : '#0284c7'}; }
                      `}} />
                      <ReactMarkdown>{response.natural_language_response}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Trace block */}
                <div className={`rounded-lg border p-4 flex-none ${isDark ? 'bg-[#0B1120] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    System Trace
                  </h3>
                  <pre className={`text-[11px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto custom-scrollbar ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                    <code>{response.sql_query}</code>
                  </pre>
                </div>

              </div>
            )}
          </div>
        )}

        {/* HIDDEN CHARTS FOR PDF EXPORT */}
        {response && response.result_data && response.result_data.length > 0 && (
          <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none flex flex-col gap-4 z-[-1]">
            {(() => {
              let data = [];
              let key0 = "", key1 = "";
              const sample = response.result_data[0];
              const keys = Object.keys(sample);
              const isNumeric = keys.some(k => typeof sample[k] === 'number');
              if (isNumeric) {
                data = response.result_data;
                key0 = keys[0];
                key1 = keys[1];
              } else {
                const counts: Record<string, number> = {};
                response.result_data.forEach((row: any) => {
                  const group = row.assignment_group || row.state || 'Unknown';
                  counts[group] = (counts[group] || 0) + 1;
                });
                data = Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
                key0 = "name";
                key1 = "count";
              }
              const renderKeys = isNumeric ? keys.slice(1) : ["count"];
              const COLORS = ["#0ea5e9", "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#f43f5e"];
              return (
                <>
                  <div id="pdf-export-bar" className="w-[800px] h-[400px]">
                    <RechartsBarChart width={800} height={400} data={data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                      <XAxis dataKey={key0} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-10} domain={[0, 'auto']} />
                      {renderKeys.map((key, index) => (
                        <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                      ))}
                    </RechartsBarChart>
                  </div>
                  <div id="pdf-export-pie" className="w-[800px] h-[400px]">
                    <PieChart width={800} height={400} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <Pie data={data} dataKey={key1} nameKey={key0} cx="50%" cy="50%" outerRadius="60%" label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}>
                        {data.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </div>
                  <div id="pdf-export-line" className="w-[800px] h-[400px]">
                    <LineChart width={800} height={400} data={data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                      <XAxis dataKey={key0} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-10} domain={[0, 'auto']} />
                      {renderKeys.map((key, index) => (
                        <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={3} />
                      ))}
                    </LineChart>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
