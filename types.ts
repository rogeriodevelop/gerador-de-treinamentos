
export interface Lesson {
  id: number;
  title: string;
  objective: string;
  topics: string[];
}

export interface Module {
  title: string;
  lessons: Lesson[];
}

export interface SyllabusRecord {
  id: string;
  theme: string;
  context?: string; // Dados de apoio (ementa, bibliografia, etc.)
  markdown: string;
  savedLessons: Record<number, string>; // Mapa de ID da aula -> HTML gerado
}
