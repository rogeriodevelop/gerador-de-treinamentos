
import { GoogleGenAI, Modality, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYLLABUS_PROMPT_TEMPLATE = `
Atue como: Um Arquiteto de Soluções de Aprendizagem e Especialista em Treinamentos Corporativos sobre [TEMA_DO_CURSO].

Seu objetivo: Criar um Roteiro de Treinamento (Syllabus) prático, focado em "mão na massa" e domínio de habilidades para [TEMA_DO_CURSO].

--- CONTEXTO E MATERIAL DE APOIO ---
O usuário forneceu os seguintes dados de apoio (ementa, bibliografia, objetivos específicos ou restrições). Você DEVE respeitar e incorporar estas diretrizes na estrutura do curso:
[CONTEXTO_ADICIONAL]
--- FIM DO CONTEXTO ---

Requisitos do Roteiro:

- **Foco Prático**: Os títulos das aulas devem sugerir ação (ex: "Configurando o Ambiente", "Criando seu primeiro...", "Resolvendo problemas de..."). Evite títulos puramente teóricos.
- **Estrutura Progressiva**: Comece do básico e avance passo a passo até o complexo.
- **Quantidade de Aulas**: Crie quantas aulas forem necessárias para cobrir o tema com profundidade técnica.
- **Detalhe**: Para cada aula, forneça:
  - Título da Aula.
  - Objetivo: O que o aluno saberá FAZER ao final.
  - Tópicos: As etapas ou ferramentas que serão abordadas.

- **Formato de Saída OBRIGATÓRIO (Markdown)**:
  - Para Módulos use: "Módulo X: [Título]"
  - Para Aulas use: "Aula Y: [Título]"
  - Detalhes:
    - "- Objetivo: [Texto]"
    - "- Tópicos: [A], [B], [C]"

Inicie a geração do syllabus para "[TEMA_DO_CURSO]" agora.
`;

const LESSON_PROMPT_TEMPLATE = `
Atue como: Um Especialista em Redação Técnica e Criação de Tutoriais Passo a Passo.

Contexto da Aula:
- Curso: [TEMA_DO_CURSO]
- Aula Atual: [TITULO_AULA_ATUAL]
- Aula Anterior: [TITULO_AULA_ANTERIOR]
- Próxima Aula: [TITULO_PROXIMA_AULA]

--- MATERIAL DE APOIO ---
[CONTEXTO_ADICIONAL]
--- FIM DO MATERIAL ---

--- SYLLABUS (Fluxo) ---
[SYLLABUS_COMPLETO]
--- FIM SYLLABUS ---

Sua Tarefa: Criar um GUIA DE TREINAMENTO PASSO A PASSO detalhado para a aula "[TITULO_AULA_ATUAL]".

DIRETRIZES DE CONTEÚDO (CRÍTICO):

1.  **Estrutura de Tutorial**:
    *   Não escreva grandes blocos de texto teórico. Quebre o conteúdo em **ETAPAS** ou **PASSOS** numerados.
    *   Use títulos como "Passo 1: Preparação", "Passo 2: Execução", etc.

2.  **Linguagem Instrucional**:
    *   Use verbos no imperativo (Clique, Configure, Analise, Escreva).
    *   Seja direto e específico. Explique O QUE fazer e COMO fazer.

3.  **Riqueza Visual e Detalhes (IMPORTANTE)**:
    *   **IMAGENS OBRIGATÓRIAS**: Você DEVE inserir a tag \`<ai-image-placeholder prompt="...">\` após cada conceito chave ou passo complexo.
    *   **CONTEXTO DO PROMPT**: No atributo \`prompt\`, você DEVE solicitar APENAS visual.
        *   **REGRA DE OURO**: Adicione sempre "SEM TEXTO" ou "NO TEXT" no final do prompt.
        *   EXEMPLO BOM: \`prompt="Ilustração vetorial flat de um servidor conectado a um banco de dados, fundo branco, ícones minimalistas, SEM TEXTO"\`
    *   **Quantidade**: Insira de 3 a 5 imagens por aula.

4.  **Blocos de Código e Escaping (CRÍTICO)**:
    *   Ao escrever exemplos de código (especialmente XML, HTML, React), você **DEVE ESCAPAR** os caracteres especiais para que o navegador não os interprete como tags reais.
    *   Substitua \`<\` por \`&lt;\`
    *   Substitua \`>\` por \`&gt;\`
    *   Exemplo CORRETO de output HTML:
        \`<pre>&lt;usuario&gt;João&lt;/usuario&gt;</pre>\`
    *   Nunca escreva tags XML diretamente dentro do HTML de resposta sem escapar.

5.  **Formatação HTML**:
    *   Retorne APENAS o HTML dentro de uma tag \`<article>\`.
    *   Use \`<section>\` para agrupar cada Passo Principal (Isso cria os cards visuais).
    *   Use \`<h2>\` para o Título do Passo (ex: "Passo 1: Configuração").
    *   Use listas \`<ol>\` ou \`<ul>\` para sub-instruções.
    *   Use \`<pre>\` para blocos de código grandes.

Gere o conteúdo agora. Foco total em ensinar o aluno a EXECUTAR a tarefa.
`;

const UI_ENHANCER_PROMPT_TEMPLATE = `
Atue como: Um Web Designer Sênior focado em UX de Documentação Técnica.

Contexto: Você recebeu um HTML de um treinamento técnico. O layout final utiliza "Cards" flutuantes para cada seção.

Sua Tarefa: Refinar o HTML para garantir legibilidade máxima e estrutura de tutorial.

--- HTML BRUTO ---
[HTML_DA_AULA]
--- FIM DO HTML BRUTO ---

REGRAS RÍGIDAS:
1.  **Estrutura de Cards**: Certifique-se de que cada "Passo" ou tópico principal esteja envolto em uma tag \`<section>\`.
2.  **Preservação de Imagens**: Mantenha TODAS as tags \`<ai-image-placeholder>\` intactas. Não as remova.
3.  **Correção de Código**: Verifique se blocos de código (XML/HTML) dentro de \`<pre>\` estão com as tags escapadas (\`&lt;\`, \`&gt;\`) para serem visíveis.
4.  **Estilo Inline**: Adicione estilos inline sutis para melhorar a hierarquia (ex: cores para subtítulos).
5.  **Clean Output**: Retorne APENAS o HTML limpo, sem markdown (\`\`\`) e sem texto de conversa.

Retorne apenas o HTML modificado dentro de <article>...</article>.
`;

const DIAGRAM_PROMPT_TEMPLATE = `
Atue como: Um Arquiteto de Software Sênior especialista em modelagem de dados e UML.

Sua tarefa: Gerar código Mermaid.js **estritamente válido** para o conceito: "[CONCEITO_DIAGRAMA]".

REGRAS ESPECÍFICAS DE SINTAXE E SÍMBOLOS:

1. **Para Diagramas ER (Entidade Relacionamento)**:
   - Use OBRIGATORIAMENTE a sintaxe \`erDiagram\`.
   - **Notação Crow's Foot (Pé de Galinha)** para relacionamentos:
     - \`||--||\` : Um para exatamente um.
     - \`||--|{\` : Um para um ou mais (obrigatório).
     - \`||--o{\` : Um para zero ou mais (opcional).
     - \`||--o|\` : Um para zero ou um.
   - **Entidades e Atributos**:
     - Defina as entidades e abra blocos \`{}\` para atributos.
     - Especifique **tipo de dado** e **chaves** (PK, FK) para cada atributo.
   - Exemplo Correto:
     erDiagram
       CLIENTE ||--o{ PEDIDO : realiza
       CLIENTE {
         int id PK
         string nome
         string email
       }
       PEDIDO {
         int id PK
         int cliente_id FK
         date data_pedido
       }

2. **Para Diagramas de Classe (UML)**:
   - Use \`classDiagram\`.
   - Defina propriedades (\`+public\`, \`-private\`) e métodos.

3. **Para Fluxogramas**:
   - Use \`flowchart TD\` (Top-Down) ou \`LR\` (Left-Right).
   - Use formas corretas: \`[]\` para processo, \`{}\` para decisão.

REGRAS GERAIS:
- Retorne APENAS o código Mermaid.
- NÃO use blocos de markdown (\`\`\`mermaid).
- Se a solicitação for genérica (ex: "banco de dados loja"), crie um modelo completo e profissional (3ª Forma Normal).

Inicie a geração do código Mermaid.js para "[CONCEITO_DIAGRAMA]" agora.
`;


export const generateSyllabus = async (courseTheme: string, context: string = ""): Promise<string> => {
    try {
        let prompt = SYLLABUS_PROMPT_TEMPLATE.replace(/\[TEMA_DO_CURSO\]/g, courseTheme);
        prompt = prompt.replace(/\[CONTEXTO_ADICIONAL\]/g, context || "Nenhum contexto adicional fornecido.");
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    } catch (error) {
        console.error("Error generating syllabus:", error);
        throw new Error("Falha ao gerar o syllabus. Verifique sua chave de API e a conexão.");
    }
};

export const generateLessonHtml = async (
    courseTheme: string,
    fullSyllabus: string,
    currentLessonTitle: string,
    previousLessonTitle: string | null,
    nextLessonTitle: string | null,
    context: string = ""
): Promise<string> => {
    try {
        let prompt = LESSON_PROMPT_TEMPLATE
            .replace(/\[TEMA_DO_CURSO\]/g, courseTheme)
            .replace(/\[SYLLABUS_COMPLETO\]/g, fullSyllabus)
            .replace(/\[TITULO_AULA_ATUAL\]/g, currentLessonTitle)
            .replace(/\[TITULO_AULA_ANTERIOR\]/g, previousLessonTitle || "nenhuma (esta é a primeira aula)")
            .replace(/\[TITULO_PROXIMA_AULA\]/g, nextLessonTitle || "nenhuma (esta é a última aula)");
        
        prompt = prompt.replace(/\[CONTEXTO_ADICIONAL\]/g, context || "Siga as melhores práticas acadêmicas padrão.");

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    } catch (error) {
        console.error("Error generating lesson HTML:", error);
        throw new Error("Falha ao gerar o conteúdo da aula. Tente novamente.");
    }
};

export const enhanceLessonUi = async (lessonHtml: string): Promise<string> => {
    try {
        const prompt = UI_ENHANCER_PROMPT_TEMPLATE.replace(/\[HTML_DA_AULA\]/g, lessonHtml);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Usar modelo pro para melhor compreensão semântica
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                temperature: 0.3,
            }
        });
        
        let text = response.text;
        
        // LIMPEZA CRÍTICA: Extrair apenas o conteúdo dentro de <article>...</article>
        const articleMatch = text.match(/<article[\s\S]*?<\/article>/i);
        if (articleMatch) {
            text = articleMatch[0];
        } else {
            text = text.replace(/^```html\s*/, '').replace(/```\s*$/, '');
        }

        text = text.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');

        return text;
    } catch (error) {
        console.error("Error enhancing lesson UI:", error);
        return lessonHtml;
    }
};

// --- Funções Auxiliares para Imagem ---

const isResourceExhausted = (error: any) => {
    return error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
};

// Função base simplificada e focada em economia de tokens
const generateRawImage = async (prompt: string): Promise<string> => {
    try {
        // PROMPT "TOKEN SAVER": Força iconografia limpa sem texto.
        // Isso remove a necessidade de validação e re-tentativas.
        const cleanPrompt = `${prompt}. 
        Style: High-quality corporate vector illustration, flat design, white background, minimalist. 
        CRITICAL INSTRUCTION: DO NOT INCLUDE ANY TEXT, LETTERS, NUMBERS, OR WORDS in the image. 
        Use ONLY visual icons, symbols, and metaphors.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: cleanPrompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        if (response.candidates && response.candidates.length > 0) {
             for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
        throw new Error("Nenhum dado de imagem retornado.");
    } catch (error) {
        throw error;
    }
}

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    // REMOVIDO: Loop de validação e re-tentativas baseadas em qualidade.
    // MOTIVO: Economia de Cota (Erro 429).
    // O sistema agora faz 1 chamada única por imagem.
    // Se der erro 429, o App.tsx já está configurado para cancelar e avisar.
    
    try {
        return await generateRawImage(prompt);
    } catch (error: any) {
        console.warn(`Erro ao gerar imagem:`, error);
        // Repassa o erro para o App.tsx tratar (cancelar a aula)
        throw error;
    }
};

export const generateDiagramMermaid = async (diagramConcept: string): Promise<string> => {
    try {
        const prompt = DIAGRAM_PROMPT_TEMPLATE.replace(/\[CONCEITO_DIAGRAMA\]/g, diagramConcept);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                temperature: 0.2,
            }
        });
        
        let mermaidCode = response.text;
        mermaidCode = mermaidCode.replace(/^```mermaid\s*/, '');
        mermaidCode = mermaidCode.replace(/```\s*$/, '');
        return mermaidCode.trim();
        
    } catch (error) {
        console.error("Error generating diagram:", error);
        throw new Error("Falha ao gerar o diagrama. Tente novamente.");
    }
};
