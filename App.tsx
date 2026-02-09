
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Module, Lesson, SyllabusRecord } from './types';
import { generateSyllabus, generateLessonHtml, enhanceLessonUi, generateImageFromPrompt, generateDiagramMermaid } from './services/geminiService';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

declare global {
    interface Window {
        mermaid?: {
            run: (options?: { nodes: Array<Element>, suppressErrors?: boolean }) => void;
        };
    }
}

// ==========================================
// ESTILOS COMPARTILHADOS (PREVIEW E DOWNLOAD)
// ==========================================
// Esta função garante que o arquivo baixado seja visualmente idêntico à pré-visualização.
const getLessonCss = () => `
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code&family=Inter:wght@400;500;600;700;800&display=swap');
    
    :root {
        --primary-color: #2563eb;
        --secondary-color: #4f46e5;
        --heading-color: #111827;
        --text-color: #374151;
        --bg-color: #f3f4f6;
        --card-bg: #ffffff;
        --code-bg: #1e293b;
    }

    body {
        font-family: 'Inter', sans-serif;
        background-color: var(--bg-color);
        color: var(--text-color);
        line-height: 1.8;
        margin: 0;
        padding: 2rem 1rem;
    }

    article {
        max-width: 900px;
        margin: 0 auto;
    }

    /* Cabeçalho do artigo (se houver h1 solto) */
    article > h1, .lesson-header-title {
        text-align: center;
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 3rem;
        background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    /* Cards para Seções */
    section {
        background-color: var(--card-bg);
        border-radius: 1rem;
        padding: 3rem;
        margin-bottom: 3rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border: 1px solid #e5e7eb;
        border-left: 5px solid var(--primary-color);
    }

    h2 {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--heading-color);
        margin-top: 0;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
    }

    h2::before {
        content: '';
        display: inline-block;
        width: 8px;
        height: 24px;
        background-color: var(--secondary-color);
        margin-right: 12px;
        border-radius: 4px;
    }

    h3 {
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--heading-color);
        margin-top: 2rem;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 0.5rem;
    }

    p {
        margin-bottom: 1.5rem;
        text-align: justify;
    }

    /* Listas */
    ul { list-style: none; padding-left: 0; margin-bottom: 1.5rem; }
    ul li { padding-left: 1.5rem; position: relative; margin-bottom: 0.5rem; }
    ul li::before { 
        content: "•"; color: var(--primary-color); font-weight: bold; 
        font-size: 1.5rem; position: absolute; left: 0; top: -0.25rem; 
    }

    ol { padding-left: 1.5rem; margin-bottom: 1.5rem; }
    ol li { margin-bottom: 0.5rem; }

    /* Destaques / Blockquotes */
    blockquote {
        margin: 2rem 0;
        padding: 1.5rem 2rem;
        background-color: #eff6ff;
        border-radius: 0.75rem;
        border: 1px solid #dbeafe;
    }
    blockquote::before {
        content: "💡 Dica Importante";
        display: block; font-weight: 700; color: var(--primary-color);
        font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.5rem;
    }
    blockquote p { margin: 0; color: #1e3a8a; }

    /* Código */
    pre {
        background-color: #1e293b !important;
        color: #e2e8f0 !important;
        padding: 1.5rem;
        border-radius: 0.75rem;
        overflow-x: auto;
        font-family: 'Fira Code', monospace;
        font-size: 0.9em;
        margin: 2rem 0;
    }
    pre code {
        background-color: transparent !important;
        color: inherit !important;
        font-family: inherit;
        border: none;
        padding: 0;
    }

    code { font-family: 'Fira Code', monospace; }
    
    p > code, li > code {
        background-color: #e2e8f0;
        color: #0f172a;
        padding: 0.2em 0.4em;
        border-radius: 0.375rem;
        font-size: 0.9em;
        font-weight: 600;
    }

    /* Imagens */
    img {
        max-width: 100%;
        height: auto;
        border-radius: 0.75rem;
        margin: 2rem auto;
        display: block;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    }

    /* Rodapé - CONTRASTE FORÇADO */
    footer {
        margin-top: 5rem;
        padding: 3rem 2rem;
        background-color: #1f2937 !important;
        color: #f3f4f6 !important;
        border-radius: 1rem;
        text-align: center;
    }
    footer p {
        color: #e5e7eb !important;
        font-size: 1rem;
    }
    footer a { color: #60a5fa !important; }
`;

// CSS Específico para o formato de Ebook (Capa, TOC, Quebras de página)
const getEbookCss = () => `
    ${getLessonCss()}
    
    /* Regras de impressão para criar um PDF perfeito */
    @media print {
        @page { margin: 2cm; }
        .page-break { page-break-before: always; }
        a { text-decoration: none; color: black; }
        section { break-inside: avoid; }
    }

    /* Capa */
    .ebook-cover {
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        background: linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%);
        padding: 4rem 2rem;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .ebook-cover h1 {
        font-size: 4rem;
        line-height: 1.1;
        margin-bottom: 1rem;
        color: #111827;
    }
    
    .ebook-cover h2 {
        font-size: 1.5rem;
        font-weight: 400;
        color: #6b7280;
        margin-bottom: 3rem;
    }
    
    .ebook-cover img {
        max-height: 50vh;
        width: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border-radius: 1rem;
        margin-bottom: 3rem;
    }

    .ebook-author {
        font-size: 1.25rem;
        font-weight: 600;
        color: #4b5563;
        margin-top: auto;
    }

    /* Sumário */
    .ebook-toc {
        padding: 4rem 2rem;
        background-color: white;
        min-height: 90vh;
    }
    
    .ebook-toc h1 {
        text-align: center;
        margin-bottom: 3rem;
        font-size: 3rem;
    }
    
    .toc-module {
        margin-bottom: 2rem;
    }
    
    .toc-module-title {
        font-size: 1.5rem;
        font-weight: 800;
        color: #2563eb;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
    }
    
    .toc-lesson {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.75rem;
        padding-left: 1rem;
    }
    
    .toc-lesson a {
        color: #4b5563;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
        border-bottom: 1px dotted #9ca3af;
        width: 100%;
        display: flex;
        justify-content: space-between;
    }
    
    .toc-lesson a:hover {
        color: #2563eb;
    }

    .toc-lesson a::after {
        content: "Ir para aula ↗";
        font-size: 0.8rem;
        opacity: 0.5;
    }

    /* Ajustes nas aulas para o formato contínuo */
    .ebook-lesson-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 4rem 2rem;
    }
`;

// Parser mais robusto para lidar com formatações variadas da IA (negrito, hifens, etc)
const parseSyllabus = (markdown: string): Module[] => {
    const modules: Module[] = [];
    if (!markdown) return modules;

    const lines = markdown.split('\n');
    let currentModule: Module | null = null;
    let currentLesson: Lesson | null = null;
    let lessonCounter = 1;

    for (const line of lines) {
        const cleanLine = line.replace(/[*_]{2,}/g, '').trim();
        if (!cleanLine) continue;

        const moduleMatch = cleanLine.match(/^(?:#+\s*)?(?:Módulo|Modulo)\s*\d+[\s:.\-–—]+(.*)/i);
        if (moduleMatch) {
            if (currentModule) modules.push(currentModule);
            currentModule = { title: moduleMatch[1].trim(), lessons: [] };
            currentLesson = null;
            continue;
        }

        const lessonMatch = cleanLine.match(/^(?:#+\s*)?(?:Aula|Lição)\s*\d+[\s:.\-–—]+(.*)/i);
        if (lessonMatch && currentModule) {
            currentLesson = { id: lessonCounter++, title: lessonMatch[1].trim(), objective: '', topics: [] };
            currentModule.lessons.push(currentLesson);
            continue;
        }

        const objectiveMatch = cleanLine.match(/^\s*-\s*Objetivo\s*[:.\-–—]?\s*(.*)/i);
        if (objectiveMatch && currentLesson) {
            currentLesson.objective = objectiveMatch[1].trim();
            continue;
        }

        const topicsMatch = cleanLine.match(/^\s*-\s*Tópicos\s*[:.\-–—]?\s*(.*)/i);
        if (topicsMatch && currentLesson) {
            currentLesson.topics = topicsMatch[1].split(/[,;]/).map(t => t.trim()).filter(t => t);
            continue;
        }
    }

    if (currentModule) modules.push(currentModule);
    return modules;
};


const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z">
            <animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite"/>
        </path>
    </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
    </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
    </svg>
);

const SaveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
    </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 17.59 13.41 12z"/>
    </svg>
);

const BackIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
);

const DiagramIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 3v6h6V3H6zm0 12v6h6v-6H6zM15 3v6h6V3h-6zm0 12v6h6v-6h-6z"/>
    </svg>
);

const CourseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
    </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
);

const ZipIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
        <path d="M13 13h-2v-2h2v2zm-4 2h2v-2H9v2zm2 2h-2v-2h2v2zm2-2h2v-2h-2v2zm-2-6h2v-2h-2v2z"/>
    </svg>
);

const PdfIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
    </svg>
);

const BookIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
);

const App: React.FC = () => {
    const [courseTheme, setCourseTheme] = useState<string>('');
    const [courseContext, setCourseContext] = useState<string>('');
    const [authorName, setAuthorName] = useState<string>(''); 
    const [syllabusHistory, setSyllabusHistory] = useState<SyllabusRecord[]>(() => {
        try {
            const savedHistory = localStorage.getItem('syllabusHistory');
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
            console.error("Falha Crítica: LocalStorage corrompido. Resetando histórico.", e);
            localStorage.removeItem('syllabusHistory');
            return [];
        }
    });
    const [currentSyllabusId, setCurrentSyllabusId] = useState<string | null>(null);
    const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
    const [lessonHtml, setLessonHtml] = useState<string>('');
    const [isLoadingSyllabus, setIsLoadingSyllabus] = useState<boolean>(false);
    const [isLoadingLesson, setIsLoadingLesson] = useState<boolean>(false);
    const [lessonGenerationMessage, setLessonGenerationMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    
    const [activeTool, setActiveTool] = useState<'course' | 'diagram'>('course');
    const [diagramPrompt, setDiagramPrompt] = useState<string>('');
    const [mermaidCode, setMermaidCode] = useState<string>('');
    const [isLoadingDiagram, setIsLoadingDiagram] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<string>('');

    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; status: string; title: string } | null>(null);
    
    const contentWrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const historyToSave = syllabusHistory.map(record => ({
                ...record,
                savedLessons: {} 
            }));
            localStorage.setItem('syllabusHistory', JSON.stringify(historyToSave));
        } catch (e) {
            console.error("Falha ao salvar o histórico do syllabus no localStorage", e);
        }
    }, [syllabusHistory]);
    
    useEffect(() => {
        if (mermaidCode && activeTool === 'diagram' && contentWrapperRef.current) {
            const mermaidContainer = contentWrapperRef.current.querySelector('.mermaid');
            if (mermaidContainer) {
                mermaidContainer.innerHTML = mermaidCode;
                try {
                    window.mermaid?.run({ nodes: [mermaidContainer] });
                } catch (e) {
                    console.error("Mermaid rendering error:", e);
                    mermaidContainer.innerHTML = `<div class="text-red-600 font-mono p-4 bg-red-50 border border-red-200 rounded-md"><b>Erro no código do diagrama:</b><br/>${(e as Error).message}</div>`;
                }
            }
        }
    }, [mermaidCode, activeTool]);

    // Background Canvas Animation Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: { x: number, y: number, vx: number, vy: number }[];

        const setup = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);

            const particleCount = Math.floor((canvas.width * canvas.height) / (dpr * dpr * 15000));
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * rect.width,
                    y: Math.random() * rect.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                });
            }
        };

        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
            
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > rect.width) p.vx *= -1;
                if (p.y < 0 || p.y > rect.height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(203, 213, 225, 0.5)';
                ctx.fill();
            });

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(203, 213, 225, ${1 - dist / 120})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
        };

        const animate = () => {
            draw();
            animationFrameId = requestAnimationFrame(animate);
        };

        const resizeObserver = new ResizeObserver(setup);
        resizeObserver.observe(canvas);
        
        setup();
        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
        };
    }, []);

    const currentSyllabus = useMemo(() => {
        return syllabusHistory.find(s => s.id === currentSyllabusId) ?? null;
    }, [currentSyllabusId, syllabusHistory]);

    const parsedSyllabus = useMemo(() => parseSyllabus(currentSyllabus?.markdown ?? ''), [currentSyllabus]);
    const allLessons = useMemo(() => parsedSyllabus.flatMap(m => m.lessons), [parsedSyllabus]);

    const currentLessonDetails = useMemo(() => {
        if (!selectedLessonId || !parsedSyllabus.length) return null;
        for (let mIndex = 0; mIndex < parsedSyllabus.length; mIndex++) {
            const module = parsedSyllabus[mIndex];
            const lIndex = module.lessons.findIndex(l => l.id === selectedLessonId);
            if (lIndex !== -1) {
                return {
                    title: module.lessons[lIndex].title,
                    fullTitle: `Módulo ${mIndex + 1} - Aula ${lIndex + 1}: ${module.lessons[lIndex].title}`
                };
            }
        }
        return null;
    }, [selectedLessonId, parsedSyllabus]);

    useEffect(() => {
        if ((lessonHtml || mermaidCode) && contentWrapperRef.current) {
            contentWrapperRef.current.scrollTop = 0;
        }
    }, [lessonHtml, mermaidCode]);
    
    useEffect(() => {
        setLessonHtml('');
        
        if (selectedLessonId !== null && currentSyllabus) {
            const savedLessonHtml = currentSyllabus.savedLessons?.[selectedLessonId] || 
                                   (currentSyllabus.savedLessons && currentSyllabus.savedLessons[String(selectedLessonId)]);
            
            if (savedLessonHtml) {
                setLessonHtml(savedLessonHtml);
            }
        }
    }, [selectedLessonId, currentSyllabus]);

    useEffect(() => {
        setSelectedLessonId(null);
        setLessonHtml('');
    }, [currentSyllabusId]);

    const saveLessonToHistory = useCallback((syllabusId: string, lessonId: number, htmlContent: string) => {
        setSyllabusHistory(prev => prev.map(record => {
            if (record.id === syllabusId) {
                return {
                    ...record,
                    savedLessons: {
                        ...(record.savedLessons || {}),
                        [lessonId]: htmlContent
                    }
                };
            }
            return record;
        }));
    }, []);

    const handleDeleteLessonContent = useCallback((lessonId: number) => {
        if (!currentSyllabusId) return;

        if (window.confirm("Tem certeza que deseja apagar o conteúdo salvo desta aula? Você precisará gerá-la novamente.")) {
            if (selectedLessonId === lessonId) {
                setLessonHtml('');
            }

            setSyllabusHistory(prev => prev.map(record => {
                if (record.id === currentSyllabusId) {
                    const newSavedLessons = { ...record.savedLessons };
                    if (newSavedLessons) {
                        Object.keys(newSavedLessons).forEach(key => {
                            if (String(key) === String(lessonId)) {
                                delete newSavedLessons[key as any]; 
                            }
                        });
                    }
                    return {
                        ...record,
                        savedLessons: newSavedLessons
                    };
                }
                return record;
            }));
        }
    }, [currentSyllabusId, selectedLessonId]);

    const processAndInjectImages = useCallback(async (htmlWithPlaceholders: string, onStatusUpdate?: (msg: string) => void): Promise<string> => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlWithPlaceholders, 'text/html');
        const placeholders = Array.from(doc.querySelectorAll('ai-image-placeholder'));

        if (placeholders.length === 0) return htmlWithPlaceholders;
        
        if (onStatusUpdate) onStatusUpdate(`Preparando para gerar ${placeholders.length} imagens...`);
        else setLessonGenerationMessage(`Preparando para gerar ${placeholders.length} imagens...`);
        
        const imageResults: string[] = [];
        
        for (let i = 0; i < placeholders.length; i++) {
             const ph = placeholders[i];
             const prompt = ph.getAttribute('prompt');
             
             const statusMsg = `Gerando e revisando imagem ${i+1} de ${placeholders.length}...`;
             
             if (onStatusUpdate) onStatusUpdate(statusMsg);
             else setLessonGenerationMessage(statusMsg);
             
             if (!prompt) {
                 continue;
             }
             try {
                 const result = await generateImageFromPrompt(prompt);
                 imageResults.push(result);
             } catch (e: any) {
                 console.error("Failed to generate an image:", e);
                 // CRITICAL FIX: Se houver erro de cota ou falha geral, aborta o processo
                 // para não salvar uma aula com placeholders de erro.
                 if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
                     throw new Error("Limite de cota da API excedido (Erro 429). A geração foi cancelada para evitar conteúdo incompleto. Aguarde alguns minutos.");
                 }
                 throw new Error(`Falha ao gerar imagem: ${e.message}. A geração da aula foi cancelada.`);
             }
        }

        placeholders.forEach((placeholder, index) => {
            const base64Data = imageResults[index];
            if (base64Data) {
                const img = doc.createElement('img');
                img.src = `data:image/png;base64,${base64Data}`;
                img.alt = placeholder.getAttribute('prompt') || 'Imagem gerada por IA';
                if (placeholder.getAttribute('style')) {
                    img.setAttribute('style', placeholder.getAttribute('style')!);
                }
                placeholder.parentNode?.replaceChild(img, placeholder);
            }
        });
        
        return doc.body.innerHTML;
    }, []);

    const handleGenerateSyllabus = useCallback(async () => {
        if (!courseTheme.trim()) {
            setError("Por favor, insira um tema para o curso.");
            return;
        }
        setIsLoadingSyllabus(true);
        setError(null);
        setLessonHtml('');
        setSelectedLessonId(null);
        try {
            const result = await generateSyllabus(courseTheme, courseContext);
            const newRecord: SyllabusRecord = {
                id: Date.now().toString(),
                theme: courseTheme,
                context: courseContext,
                markdown: result,
                savedLessons: {}
            };
            setSyllabusHistory(prev => [newRecord, ...prev]);
            setCurrentSyllabusId(newRecord.id);
            setCourseTheme('');
            setCourseContext('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoadingSyllabus(false);
        }
    }, [courseTheme, courseContext]);
    
    const handleGenerateLesson = useCallback(async () => {
        if (!currentSyllabus || selectedLessonId === null) {
            return;
        }

        setLessonHtml('');
        setIsLoadingLesson(true);
        setError(null);
        setLessonGenerationMessage('Inicializando IA...');

        await new Promise(resolve => setTimeout(resolve, 50));

        const isLessonSaved = currentSyllabus.savedLessons && 
            (currentSyllabus.savedLessons[selectedLessonId] !== undefined || 
             currentSyllabus.savedLessons[String(selectedLessonId)] !== undefined);

        if (isLessonSaved) {
            const confirmRegenerate = window.confirm(
                "Esta aula já foi gerada. Deseja criar novas imagens e texto? O conteúdo atual será substituído."
            );
            if (!confirmRegenerate) {
                const saved = currentSyllabus.savedLessons[selectedLessonId] || currentSyllabus.savedLessons[String(selectedLessonId)];
                setLessonHtml(saved);
                setIsLoadingLesson(false);
                return;
            }
        }
        
        setLessonGenerationMessage('Gerando novo texto base da aula...');

        try {
            const modules = parseSyllabus(currentSyllabus.markdown);
            const flatLessons = modules.flatMap(m => m.lessons);
            const currentLesson = flatLessons.find(l => l.id === selectedLessonId);

            if (!currentLesson) {
                throw new Error("Aula não encontrada na estrutura do curso.");
            }

            const currentIndex = flatLessons.findIndex(l => l.id === selectedLessonId);
            const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
            const nextLesson = currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

            let moduleIndex = 0;
            let lessonIndexInModule = 0;
            modules.forEach((m, idx) => {
                const lIdx = m.lessons.findIndex(l => l.id === selectedLessonId);
                if (lIdx !== -1) {
                    moduleIndex = idx;
                    lessonIndexInModule = lIdx;
                }
            });
            const formattedLessonTitle = `Módulo ${moduleIndex + 1} - Aula ${lessonIndexInModule + 1}: ${currentLesson.title}`;

            const htmlWithPlaceholders = await generateLessonHtml(
                currentSyllabus.theme,
                currentSyllabus.markdown,
                formattedLessonTitle,
                prevLesson?.title ?? null,
                nextLesson?.title ?? null,
                currentSyllabus.context
            );

            setLessonGenerationMessage('Melhorando o design e a estrutura...');
            const enhancedHtml = await enhanceLessonUi(htmlWithPlaceholders);
            
            setLessonGenerationMessage('Iniciando geração de novas imagens e revisão ortográfica...');
            const finalHtml = await processAndInjectImages(enhancedHtml);
            
            setLessonHtml(finalHtml);
            saveLessonToHistory(currentSyllabus.id, selectedLessonId, finalHtml);
            
            setTimeout(() => alert("Aula regenerada com sucesso!"), 100);

        } catch (e: any) {
            console.error("Erro na geração da aula:", e);
            setError(e.message);
            // IMPORTANTE: Como houve erro, não chamamos saveLessonToHistory com conteúdo parcial.
            // O estado lessonHtml permanece vazio ou com o erro visível via setError.
        } finally {
            setIsLoadingLesson(false);
            setLessonGenerationMessage('');
        }
    }, [selectedLessonId, currentSyllabus, saveLessonToHistory, processAndInjectImages]);

    const handleGenerateEbook = useCallback(async () => {
        if (!currentSyllabus) return;
        if (!parsedSyllabus.length) {
            setError("Não foi possível identificar as aulas no syllabus.");
            return;
        }
        if (!authorName.trim()) {
            setError("Por favor, insira o nome do autor para a capa do Ebook.");
            return;
        }

        const totalLessons = allLessons.length;
        setBulkProgress({ current: 0, total: totalLessons, status: 'Gerando capa...', title: 'EBOOK COMPLETO' });

        try {
            let coverImageBase64 = '';
            try {
                coverImageBase64 = await generateImageFromPrompt(`Book cover design for a course titled '${currentSyllabus.theme}'. Professional, modern, high quality, 4k, minimalist, nice typography.`);
            } catch (e) {
                console.warn("Falha ao gerar capa", e);
            }

            const processedLessons: { title: string; html: string; id: string }[] = [];
            let processedCount = 0;

            for (let mIndex = 0; mIndex < parsedSyllabus.length; mIndex++) {
                const module = parsedSyllabus[mIndex];
                
                for (let lIndex = 0; lIndex < module.lessons.length; lIndex++) {
                    const lesson = module.lessons[lIndex];
                    processedCount++;
                    const anchorId = `lesson-${mIndex}-${lIndex}`;
                    
                    let finalBodyHtml = '';
                    const savedContent = currentSyllabus.savedLessons?.[lesson.id] || 
                                       (currentSyllabus.savedLessons && currentSyllabus.savedLessons[String(lesson.id)]);

                    if (savedContent) {
                         setBulkProgress({ 
                            current: processedCount, 
                            total: totalLessons, 
                            status: `Recuperando aula ${processedCount}/${totalLessons}...`, 
                            title: lesson.title 
                        });
                        finalBodyHtml = savedContent;
                        await new Promise(r => setTimeout(r, 10)); // UI refresh
                    } else {
                        setBulkProgress({ 
                            current: processedCount, 
                            total: totalLessons, 
                            status: `Gerando aula ${processedCount}/${totalLessons} com IA...`, 
                            title: lesson.title 
                        });

                        const globalIndex = allLessons.findIndex(l => l.id === lesson.id);
                        const prevLesson = globalIndex > 0 ? allLessons[globalIndex - 1] : null;
                        const nextLesson = globalIndex < allLessons.length - 1 ? allLessons[globalIndex + 1] : null;
                        
                        const numberedTitle = `Módulo ${mIndex + 1} - Aula ${lIndex + 1}: ${lesson.title}`;

                        const htmlWithPlaceholders = await generateLessonHtml(
                            currentSyllabus.theme,
                            currentSyllabus.markdown,
                            numberedTitle,
                            prevLesson?.title ?? null,
                            nextLesson?.title ?? null,
                            currentSyllabus.context
                        );

                        const enhancedHtml = await enhanceLessonUi(htmlWithPlaceholders);
                        finalBodyHtml = await processAndInjectImages(enhancedHtml, (msg) => {
                             setBulkProgress(prev => prev ? { ...prev, status: msg } : null);
                        });
                        
                        saveLessonToHistory(currentSyllabus.id, lesson.id, finalBodyHtml);
                    }

                    processedLessons.push({
                        title: `Módulo ${mIndex + 1}: ${lesson.title}`,
                        html: finalBodyHtml,
                        id: anchorId
                    });
                }
            }

            setBulkProgress({ current: totalLessons, total: totalLessons, status: 'Montando Ebook...', title: 'Finalizando' });

            const tocHtml = `
                <div class="ebook-toc page-break">
                    <h1>Sumário</h1>
                    ${parsedSyllabus.map((module, mIndex) => `
                        <div class="toc-module">
                            <div class="toc-module-title">Módulo ${mIndex + 1}: ${module.title}</div>
                            ${module.lessons.map((lesson, lIndex) => `
                                <div class="toc-lesson">
                                    <a href="#lesson-${mIndex}-${lIndex}">${lIndex + 1}. ${lesson.title}</a>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            `;

            const contentHtml = processedLessons.map(item => `
                <div id="${item.id}" class="ebook-lesson-container page-break">
                    <h2 style="color:#2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom:1rem; margin-top:0;">${item.title}</h2>
                    ${item.html}
                </div>
            `).join('');

            const fullEbookHtml = `<!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${currentSyllabus.theme} - Ebook</title>
                <style>${getEbookCss()}</style>
            </head>
            <body>
                <!-- Capa -->
                <div class="ebook-cover page-break">
                    <h1>${currentSyllabus.theme}</h1>
                    <h2>Um guia completo passo a passo</h2>
                    ${coverImageBase64 ? `<img src="data:image/png;base64,${coverImageBase64}" alt="Capa" />` : ''}
                    <div class="ebook-author">Autor: ${authorName}</div>
                </div>

                <!-- Sumário -->
                ${tocHtml}

                <!-- Conteúdo -->
                ${contentHtml}
            </body>
            </html>`;

            const blob = new Blob([fullEbookHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const sanitizedTitle = currentSyllabus.theme.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            a.href = url;
            a.download = `Ebook-${sanitizedTitle}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e: any) {
            setError(`Erro ao gerar Ebook: ${e.message}`);
        } finally {
            setBulkProgress(null);
        }
    }, [currentSyllabus, parsedSyllabus, allLessons, saveLessonToHistory, authorName, processAndInjectImages]);

    const handleGenerateAndDownloadAll = useCallback(async () => {
        if (!currentSyllabus) return;
        if (!parsedSyllabus.length) {
            setError("Não foi possível identificar as aulas no syllabus. Tente gerar o syllabus novamente.");
            return;
        }

        const totalLessons = allLessons.length;
        setBulkProgress({ current: 0, total: totalLessons, status: 'Iniciando...', title: '' });
        const zip = new JSZip();
        const folder = zip.folder(`curso-${currentSyllabus.theme.substring(0, 20).replace(/[^a-z0-9]/gi, '-')}`);

        try {
            let processedCount = 0;
            
            for (let mIndex = 0; mIndex < parsedSyllabus.length; mIndex++) {
                const module = parsedSyllabus[mIndex];
                
                for (let lIndex = 0; lIndex < module.lessons.length; lIndex++) {
                    const lesson = module.lessons[lIndex];
                    processedCount++;
                    
                    const savedContent = currentSyllabus.savedLessons?.[lesson.id] || 
                                       (currentSyllabus.savedLessons && currentSyllabus.savedLessons[String(lesson.id)]);
                    
                    let finalBodyHtml = '';

                    if (savedContent) {
                        setBulkProgress({ 
                            current: processedCount, 
                            total: totalLessons, 
                            status: `Recuperando do cache...`, 
                            title: `Mód ${mIndex+1} / Aula ${lIndex+1}: ${lesson.title}` 
                        });
                        finalBodyHtml = savedContent;
                        await new Promise(r => setTimeout(r, 50)); 
                    } else {
                        setBulkProgress({ 
                            current: processedCount, 
                            total: totalLessons, 
                            status: `Gerando texto (${Math.floor((processedCount/totalLessons)*100)}%)...`, 
                            title: `Mód ${mIndex+1} / Aula ${lIndex+1}: ${lesson.title}` 
                        });

                        const globalIndex = allLessons.findIndex(l => l.id === lesson.id);
                        const prevLesson = globalIndex > 0 ? allLessons[globalIndex - 1] : null;
                        const nextLesson = globalIndex < allLessons.length - 1 ? allLessons[globalIndex + 1] : null;
                        
                        const numberedTitle = `Módulo ${mIndex + 1} - Aula ${lIndex + 1}: ${lesson.title}`;

                        const htmlWithPlaceholders = await generateLessonHtml(
                            currentSyllabus.theme,
                            currentSyllabus.markdown,
                            numberedTitle,
                            prevLesson?.title ?? null,
                            nextLesson?.title ?? null,
                            currentSyllabus.context
                        );

                        setBulkProgress(prev => ({ ...prev!, status: 'Melhorando design...' }));
                        const enhancedHtml = await enhanceLessonUi(htmlWithPlaceholders);

                        setBulkProgress(prev => ({ ...prev!, status: 'Analisando imagens...' }));
                        finalBodyHtml = await processAndInjectImages(enhancedHtml, (statusMsg) => {
                            setBulkProgress(prev => prev ? { ...prev, status: statusMsg } : null);
                        });
                        
                        saveLessonToHistory(currentSyllabus.id, lesson.id, finalBodyHtml);
                    }

                    const numberedTitle = `Módulo ${mIndex + 1} - Aula ${lIndex + 1}: ${lesson.title}`;
                    
                    const fullHtml = `<!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>${numberedTitle}</title>
                        <style>${getLessonCss()}</style>
                    </head>
                    <body>
                        <article>
                            <h1>${numberedTitle}</h1>
                            ${finalBodyHtml}
                        </article>
                    </body>
                    </html>`;

                    const safeTitle = lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
                    const filename = `M${String(mIndex + 1).padStart(2, '0')}-A${String(lIndex + 1).padStart(2, '0')}-${safeTitle}.html`;
                    
                    folder?.file(filename, fullHtml);
                    
                    if (!savedContent) {
                         await new Promise(r => setTimeout(r, 200));
                    }
                }
            }

            setBulkProgress({ current: totalLessons, total: totalLessons, status: 'Compactando arquivos...', title: 'Finalizando' });
            
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `curso-completo-${currentSyllabus.theme.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e: any) {
            setError(`Erro durante a geração em massa: ${e.message}`);
        } finally {
            setBulkProgress(null);
        }

    }, [currentSyllabus, parsedSyllabus, allLessons, saveLessonToHistory, processAndInjectImages]);

    const handleGenerateDiagram = useCallback(async () => {
        if (!diagramPrompt.trim()) {
            setError("Por favor, descreva o diagrama a ser gerado.");
            return;
        }
        setIsLoadingDiagram(true);
        setError(null);
        setMermaidCode('');

        try {
            const result = await generateDiagramMermaid(diagramPrompt);
            setMermaidCode(result);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoadingDiagram(false);
        }
    }, [diagramPrompt]);

    const handleCopyMermaid = () => {
        if (!mermaidCode) return;
        navigator.clipboard.writeText(mermaidCode).then(() => {
            setCopySuccess('Copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('Falha ao copiar');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    const handleDownloadSvg = () => {
        const svgElement = contentWrapperRef.current?.querySelector('.mermaid svg');
        if (!svgElement) return;

        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgElement);
        if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        
        source = `<style>svg{background-color:white; font-family: sans-serif;}</style>${source}`;

        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const sanitizedTitle = diagramPrompt.substring(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        a.href = url;
        a.download = `diagrama-${sanitizedTitle}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPdf = async () => {
        const svgElement = contentWrapperRef.current?.querySelector('.mermaid svg');
        if (!svgElement) return;

        try {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            const svgRect = svgElement.getBoundingClientRect();
            const width = svgRect.width * 2; 
            const height = svgRect.height * 2;
            
            canvas.width = width;
            canvas.height = height;
            
            const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
                if(ctx) {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF({
                        orientation: width > height ? 'l' : 'p',
                        unit: 'px',
                        format: [width/2 + 40, height/2 + 40] 
                    });
                    
                    pdf.addImage(imgData, 'PNG', 20, 20, width/2, height/2);
                    pdf.save(`diagrama-${diagramPrompt.substring(0, 20).replace(/[^a-z0-9]/gi, '-')}.pdf`);
                    URL.revokeObjectURL(url);
                }
            };
            img.src = url;

        } catch (e) {
            console.error(e);
            setError("Erro ao gerar PDF. Tente baixar o SVG.");
        }
    };

    const handleDownloadHtml = () => {
        if (!lessonHtml || selectedLessonId === null) return;
        const lesson = allLessons.find(l => l.id === selectedLessonId);
        if(!lesson) return;
        
        let mIndex = 0;
        let lIndex = 0;
        parsedSyllabus.forEach((m, mi) => {
            const li = m.lessons.findIndex(l => l.id === selectedLessonId);
            if(li !== -1) { mIndex = mi; lIndex = li; }
        });
        
        const numberedTitle = `Módulo ${mIndex + 1} - Aula ${lIndex + 1}: ${lesson.title}`;
        
        const fullHtml = `<!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${numberedTitle}</title>
            <style>${getLessonCss()}</style>
        </head>
        <body>
            <article>
                <h1>${numberedTitle}</h1>
                ${lessonHtml}
            </article>
        </body>
        </html>`;
        
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const sanitizedTitle = lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        a.href = url;
        a.download = `M${String(mIndex+1).padStart(2,'0')}-A${String(lIndex+1).padStart(2,'0')}-${sanitizedTitle}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- FUNÇÕES ADICIONADAS PARA CORREÇÃO DOS ERROS ---

    const handleDeleteSyllabus = useCallback((id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este syllabus e todo o seu conteúdo histórico?")) {
            setSyllabusHistory(prev => prev.filter(s => s.id !== id));
            if (currentSyllabusId === id) {
                setCurrentSyllabusId(null);
                setLessonHtml('');
                setSelectedLessonId(null);
            }
        }
    }, [currentSyllabusId]);

    const handleExportData = useCallback(() => {
        const dataStr = JSON.stringify(syllabusHistory, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-cursos-ia-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [syllabusHistory]);

    const handleImportData = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    const valid = parsed.every((item: any) => item.id && item.theme && item.markdown);
                    if (valid) {
                        setSyllabusHistory(parsed);
                        alert("Histórico restaurado com sucesso!");
                    } else {
                        alert("Arquivo inválido. Formato incorreto.");
                    }
                } else {
                    alert("Arquivo inválido. Deve ser uma lista de syllabus.");
                }
            } catch (err) {
                console.error(err);
                alert("Erro ao ler o arquivo.");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, []);

    const handleDownloadSyllabus = useCallback(() => {
        if (!currentSyllabus) return;
        const blob = new Blob([currentSyllabus.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `syllabus-${currentSyllabus.theme.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [currentSyllabus]);

    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
            {/* Bulk Generation Progress Overlay */}
            {bulkProgress && (
                <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
                        <LoaderIcon className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-spin" />
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{bulkProgress.title === 'EBOOK COMPLETO' ? 'Gerando Ebook Completo' : 'Gerando Curso'}</h3>
                        <p className="text-gray-600 mb-6">Isso pode levar alguns minutos. Não feche a janela.</p>
                        
                        <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                            <div 
                                className="bg-purple-600 h-4 rounded-full transition-all duration-500" 
                                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                            ></div>
                        </div>
                        
                        <div className="flex justify-between text-sm font-medium text-gray-700 mb-4">
                            <span>{bulkProgress.title === 'EBOOK COMPLETO' ? 'Progresso' : `Aula ${bulkProgress.current} de ${bulkProgress.total}`}</span>
                            <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-left">
                            <p className="text-xs text-purple-500 uppercase tracking-wide font-bold mb-1">{bulkProgress.status}</p>
                            <p className="text-sm text-purple-900 truncate font-medium">{bulkProgress.title}</p>
                        </div>
                    </div>
                </div>
            )}

            <aside className="md:col-span-1 lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col h-full overflow-hidden">
                <div className="border-b pb-4 mb-4 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-gray-800">Gerador de Curso IA</h1>
                    <p className="text-sm text-gray-500 mt-1">Crie cursos completos e diagramas técnicos.</p>
                </div>
                
                <div className="flex border border-gray-200 rounded-lg p-1 bg-gray-100 mb-6 flex-shrink-0">
                    <button
                        onClick={() => setActiveTool('course')}
                        className={`w-1/2 py-2 px-3 text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${activeTool === 'course' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        <CourseIcon className="w-5 h-5" />
                        <span>Curso</span>
                    </button>
                    <button
                        onClick={() => setActiveTool('diagram')}
                        className={`w-1/2 py-2 px-3 text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${activeTool === 'diagram' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        <DiagramIcon className="w-5 h-5" />
                        <span>Diagramador</span>
                    </button>
                </div>

                {activeTool === 'course' && (
                    <div className="flex-grow flex flex-col space-y-4 overflow-hidden">
                        <div className="space-y-3 flex-shrink-0">
                            <h2 className="text-lg font-semibold text-gray-700">1. Gerar Novo Syllabus</h2>
                            <input
                                type="text"
                                value={courseTheme}
                                onChange={(e) => setCourseTheme(e.target.value)}
                                placeholder="Tema do Curso (Ex: Python para Data Science)"
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 bg-white text-gray-800"
                            />
                            
                            {/* Campo de Contexto Adicional */}
                            <textarea
                                value={courseContext}
                                onChange={(e) => setCourseContext(e.target.value)}
                                placeholder="Contexto/Material de Apoio (Opcional):&#10;- Cole aqui a ementa oficial&#10;- Bibliografia obrigatória&#10;- Objetivos específicos do curso"
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-24 resize-none bg-white text-gray-800 text-sm"
                            />

                            <button
                                onClick={handleGenerateSyllabus}
                                disabled={isLoadingSyllabus || isLoadingLesson || !!bulkProgress}
                                className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                            >
                                {isLoadingSyllabus ? <><LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> Gerando...</> : 'Gerar Syllabus'}
                            </button>
                        </div>
                        
                        <div className="space-y-2 flex-grow flex flex-col min-h-0">
                            <h2 className="text-lg font-semibold text-gray-700">Histórico de Syllabus</h2>
                            <div className="flex-grow overflow-y-auto -mr-2 pr-2 border rounded-lg bg-gray-50 p-2 space-y-2">
                               {syllabusHistory.length === 0 ? (
                                   <p className="text-sm text-gray-500 text-center py-4">Nenhum syllabus gerado ainda.</p>
                               ) : (
                                    syllabusHistory.map(record => (
                                        <div
                                            key={record.id}
                                            onClick={() => setCurrentSyllabusId(record.id)}
                                            className={`p-2 rounded-md cursor-pointer transition-all duration-200 flex justify-between items-center text-sm ${currentSyllabusId === record.id ? 'bg-blue-100 border-blue-500 border-l-4 font-semibold text-blue-900' : 'hover:bg-gray-200 text-gray-800'}`}
                                        >
                                            <span className="truncate flex-grow pr-2">{record.theme}</span>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSyllabus(record.id); }} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full flex-shrink-0">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                               )}
                            </div>
                        </div>

                        {/* Backup Controls */}
                        <div className="pt-4 border-t border-gray-200 space-y-2 flex-shrink-0">
                             <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Backup Local</h2>
                             <div className="flex gap-2">
                                <button 
                                    onClick={handleExportData}
                                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-2 rounded hover:bg-gray-200 text-xs font-semibold flex items-center justify-center gap-1 border border-gray-300"
                                    title="Baixar arquivo de backup"
                                >
                                    <SaveIcon className="w-4 h-4" /> Exportar
                                </button>
                                <label className="flex-1 bg-gray-100 text-gray-700 py-2 px-2 rounded hover:bg-gray-200 text-xs font-semibold flex items-center justify-center gap-1 border border-gray-300 cursor-pointer">
                                    <UploadIcon className="w-4 h-4" /> Restaurar
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleImportData} 
                                        accept=".json" 
                                        className="hidden" 
                                    />
                                </label>
                             </div>
                             <p className="text-[10px] text-gray-400 text-center">Salve o arquivo JSON para não perder seu progresso.</p>
                        </div>

                        <div className="space-y-3 pt-4 border-t flex-shrink-0">
                            <h2 className="text-lg font-semibold text-gray-700">2. Gerar Aula</h2>
                            <p className="text-sm text-gray-500">Selecione uma aula no syllabus para gerar seu conteúdo.</p>
                            <button
                                onClick={handleGenerateLesson}
                                disabled={selectedLessonId === null || isLoadingLesson || isLoadingSyllabus || !currentSyllabus || !!bulkProgress}
                                className={`w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center ${
                                    currentSyllabus?.savedLessons && (currentSyllabus.savedLessons[selectedLessonId!] || currentSyllabus.savedLessons[String(selectedLessonId!)])
                                    ? 'bg-amber-600 hover:bg-amber-700' 
                                    : 'bg-green-600 hover:bg-green-700'
                                } ${
                                    (selectedLessonId === null || isLoadingLesson || isLoadingSyllabus || !currentSyllabus || !!bulkProgress) 
                                    ? 'bg-gray-300 cursor-not-allowed hover:bg-gray-300' 
                                    : ''
                                }`}
                            >
                                {isLoadingLesson ? (
                                    <><LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> Gerando...</>
                                ) : (
                                    currentSyllabus?.savedLessons && (currentSyllabus.savedLessons[selectedLessonId!] || currentSyllabus.savedLessons[String(selectedLessonId!)]) ? 'Regenerar Aula' : 'Gerar Conteúdo da Aula'
                                )}
                            </button>
                        </div>
                    </div>
                )}
                {activeTool === 'diagram' && (
                    <div className="flex-grow flex flex-col space-y-6">
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold text-gray-700">Agente Diagramador</h2>
                            <textarea
                                value={diagramPrompt}
                                onChange={(e) => setDiagramPrompt(e.target.value)}
                                placeholder="Ex: Diagrama de Classes UML para um sistema de Vendas, ou Modelo ER de uma Biblioteca..."
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 h-32 resize-none bg-white text-gray-800"
                            />
                            <button
                                onClick={handleGenerateDiagram}
                                disabled={isLoadingDiagram}
                                className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                            >
                                {isLoadingDiagram ? <><LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> Gerando...</> : 'Gerar Diagrama'}
                            </button>
                        </div>
                         <div className="text-sm text-gray-500 bg-gray-100 p-3 rounded-lg">
                            <p><strong>Dica:</strong> Seja específico. Peça por "UML", "Entidade Relacionamento (ER)", "Sequência" ou "Fluxograma".</p>
                        </div>
                    </div>
                )}
            </aside>
            
            <main className="md:col-span-2 lg:col-span-3 border border-gray-200 rounded-xl shadow-sm overflow-hidden relative" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0 bg-slate-900" />
                <div ref={contentWrapperRef} className="relative z-10 h-full w-full overflow-y-auto p-6 bg-white/90 backdrop-blur-[2px]">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
                            <strong className="font-bold">Erro: </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {/* --- COURSE TOOL VIEWS --- */}
                    {activeTool === 'course' && isLoadingSyllabus && (
                         <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <LoaderIcon className="w-12 h-12 text-blue-600"/>
                            <p className="mt-4 text-lg">Planejando a estrutura completa do curso...</p>
                        </div>
                    )}
                    {activeTool === 'course' && !isLoadingSyllabus && !currentSyllabusId && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <CourseIcon className="w-16 h-16 text-gray-400 mb-4" />
                            <h2 className="text-2xl font-semibold">Bem-vindo ao Gerador de Curso!</h2>
                            <p className="max-w-md mt-2">Para começar, insira o tema do seu curso e clique em "Gerar Syllabus", ou selecione um syllabus existente do seu histórico.</p>
                            <p className="mt-4 text-sm bg-blue-50 p-2 rounded text-blue-800">Dica: Use os botões de <strong>Backup</strong> na barra lateral para salvar seu progresso em arquivo.</p>
                        </div>
                    )}
                    {activeTool === 'course' && currentSyllabus && !lessonHtml && !isLoadingLesson && (
                        <div>
                            <div className="flex flex-wrap justify-between items-center mb-6 border-b pb-4 border-gray-900/10 gap-3">
                                 <h2 className="text-3xl font-bold">Syllabus: <span className="text-blue-700">{currentSyllabus.theme}</span></h2>
                                 <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={handleDownloadSyllabus} 
                                        className="bg-gray-700 text-white font-semibold py-2 px-3 md:px-4 rounded-lg hover:bg-gray-800 transition-colors duration-200 flex items-center space-x-2 text-sm md:text-base"
                                        disabled={!currentSyllabus}
                                    >
                                        <DownloadIcon className="w-5 h-5" />
                                        <span className="hidden md:inline">Baixar Syllabus</span>
                                    </button>
                                    <button
                                        onClick={handleGenerateAndDownloadAll}
                                        className="bg-purple-600 text-white font-semibold py-2 px-3 md:px-4 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center space-x-2 text-sm md:text-base"
                                    >
                                        <ZipIcon className="w-5 h-5" />
                                        <span>Baixar ZIP</span>
                                    </button>
                                 </div>
                            </div>

                             {/* Área de Geração de Ebook */}
                             <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-8 flex flex-col md:flex-row items-center gap-4">
                                <div className="flex-grow w-full">
                                    <label className="block text-sm font-medium text-indigo-900 mb-1">Autor do Ebook:</label>
                                    <input 
                                        type="text" 
                                        value={authorName}
                                        onChange={(e) => setAuthorName(e.target.value)}
                                        placeholder="Seu nome ou da sua empresa"
                                        className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <button
                                    onClick={handleGenerateEbook}
                                    className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center space-x-2 whitespace-nowrap mt-4 md:mt-0 w-full md:w-auto justify-center"
                                >
                                    <BookIcon className="w-5 h-5" />
                                    <span>Gerar Ebook Completo</span>
                                </button>
                             </div>
                            
                            {/* Visualização do Contexto no Syllabus se existir */}
                            {currentSyllabus.context && (
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
                                    <h4 className="text-blue-800 font-bold mb-2 flex items-center"><svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"/></svg> Material de Apoio Ativo</h4>
                                    <div className="text-sm text-blue-900 whitespace-pre-wrap max-h-32 overflow-y-auto pr-2">
                                        {currentSyllabus.context}
                                    </div>
                                </div>
                            )}

                            {allLessons.length === 0 && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm text-yellow-700">
                                                Não foi possível identificar as aulas. O formato gerado pela IA pode estar diferente do esperado. Tente gerar um novo syllabus.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-8">
                                {parsedSyllabus.map((module, modIndex) => (
                                    <div key={modIndex}>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4">Módulo {modIndex + 1}: {module.title}</h3>
                                        <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                                            {module.lessons.map((lesson, lessonIndex) => (
                                                <div
                                                    key={lesson.id}
                                                    onClick={() => setSelectedLessonId(lesson.id)}
                                                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex justify-between items-start ${selectedLessonId === lesson.id ? 'bg-blue-100 border-blue-500 border-l-4' : 'hover:bg-gray-100/50'}`}
                                                >
                                                    <div className="flex-grow">
                                                        <p className={`font-semibold transition-colors flex items-center gap-2 ${selectedLessonId === lesson.id ? 'text-blue-800' : 'text-gray-900'}`}>
                                                            <span className="text-gray-500 font-mono text-xs">{modIndex + 1}.{lessonIndex + 1}</span>
                                                            {lesson.title}
                                                            {currentSyllabus.savedLessons && (currentSyllabus.savedLessons[lesson.id] || currentSyllabus.savedLessons[String(lesson.id)]) && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Aula já gerada e salva">
                                                                        <CheckIcon className="w-3 h-3 mr-1" /> Salvo
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteLessonContent(lesson.id);
                                                                        }}
                                                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                                        title="Apagar conteúdo salvo desta aula"
                                                                    >
                                                                        <TrashIcon className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </p>
                                                        <p className={`text-sm mt-1 transition-colors ${selectedLessonId === lesson.id ? 'text-blue-700' : 'text-gray-700'}`}><b>Objetivo:</b> {lesson.objective}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTool === 'course' && isLoadingLesson && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <LoaderIcon className="w-12 h-12 text-green-600"/>
                            <p className="mt-4 text-lg font-medium">{lessonGenerationMessage || 'Construindo a aula...'}</p>
                            <p className="text-sm text-gray-500">A qualidade leva tempo!</p>
                        </div>
                    )}
                    {activeTool === 'course' && lessonHtml && (
                        <div>
                            <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-900/10">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setLessonHtml('')} className="text-gray-500 hover:text-gray-800 p-2 rounded-full transition-colors" aria-label="Voltar ao syllabus">
                                        <BackIcon className="w-6 h-6" />
                                    </button>
                                    <h2 className="text-2xl md:text-3xl font-bold">Conteúdo da Aula</h2>
                                </div>
                                <button onClick={handleDownloadHtml} className="bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors duration-200 flex items-center space-x-2">
                                    <DownloadIcon className="w-5 h-5" />
                                    <span>Baixar HTML</span>
                                </button>
                            </div>
                             {/* MODIFICAÇÃO: Injetar Título H1 aqui para o Preview, envolto no wrapper de estilo */}
                             <div className="lesson-content-wrapper">
                                {currentLessonDetails && <h1>{currentLessonDetails.fullTitle}</h1>}
                                <div dangerouslySetInnerHTML={{ __html: lessonHtml }} />
                             </div>
                        </div>
                    )}

                    {/* --- DIAGRAM TOOL VIEWS --- */}
                    {activeTool === 'diagram' && isLoadingDiagram && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <LoaderIcon className="w-12 h-12 text-indigo-600"/>
                            <p className="mt-4 text-lg">Desenhando seu diagrama... Isso pode levar um momento.</p>
                        </div>
                    )}
                    {activeTool === 'diagram' && !isLoadingDiagram && !mermaidCode && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <DiagramIcon className="w-16 h-16 text-gray-400 mb-4" />
                            <h2 className="text-2xl font-semibold">Agente Diagramador</h2>
                            <p className="max-w-md mt-2">Descreva um sistema para gerar UML, ER, Fluxogramas e mais.</p>
                        </div>
                    )}
                    {activeTool === 'diagram' && !isLoadingDiagram && mermaidCode && (
                        <div>
                            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 border-b pb-4 border-gray-900/10">
                                <h2 className="text-2xl md:text-3xl font-bold">Diagrama Gerado</h2>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleCopyMermaid} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center space-x-2 text-sm">
                                        <CopyIcon className="w-4 h-4" />
                                        <span>{copySuccess || 'Copiar Código'}</span>
                                    </button>
                                    <button onClick={handleDownloadSvg} className="bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors duration-200 flex items-center space-x-2 text-sm">
                                        <DownloadIcon className="w-5 h-5" />
                                        <span>SVG</span>
                                    </button>
                                    <button onClick={handleDownloadPdf} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2 text-sm">
                                        <PdfIcon className="w-5 h-5" />
                                        <span>PDF</span>
                                    </button>
                                </div>
                            </div>
                            <div className="mermaid"></div>
                            <div className="mt-8">
                                <h3 className="text-xl font-bold mb-2">Código Mermaid.js</h3>
                                <pre className="bg-gray-800 text-gray-200 p-4 rounded-lg overflow-x-auto"><code className="font-mono text-sm whitespace-pre">{mermaidCode}</code></pre>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
