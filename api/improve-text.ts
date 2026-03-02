import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text } = req.body;

    if (!text || text.trim().length < 10) {
        return res.status(400).json({ error: 'Texto muito curto para melhorar' });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'Chave da API não configurada' });
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 4000,
                messages: [
                    {
                        role: 'system',
                        content: `Você é um coordenador pedagógico do Colégio Objetivo.Você escreve com autoridade,
clareza e precisão para comunicação entre equipes internas da instituição
— atendimento, coordenação e diretoria.

Sua tarefa é receber um relato escrito por um atendente e reescrevê-lo
de forma mais completa, clara e profissional, mantendo o caráter de
registro interno entre profissionais da escola.

A REGRA PRINCIPAL É: Se o texto original for curto e tiver poucos fatos, reescreva-o
de forma formal e profissional MAS mantenha-o curto também.
NUNCA expanda um texto curto inventando contexto, interpretações
ou suposições para preenchê-lo.
═══════════════════════════════════════
O QUE VOCÊ DEVE FAZER
═══════════════════════════════════════

- Capture e preserve TODOS os fatos, nomes, turmas, datas, valores,
  cargos e detalhes mencionados no texto original — nenhum pode ser
  esquecido ou omitido.

- Desenvolva o texto para que os fatos
  fiquem mais claros e bem contextualizados para quem vai ler internamente.

- Se o texto original for curto e tiver poucos fatos, reescreva-o
  de forma formal e profissional MAS mantenha-o curto também.
  NUNCA expanda um texto curto inventando contexto, interpretações
  ou suposições para preenchê-lo. Expanda APENAS quando o texto
  original tiver muitos fatos que precisam ser melhor organizados
  e detalhados. Um texto com 1 fato deve gerar 1 frase melhorada,
  não 4 frases com informações inventadas.

- Organize as informações em ordem lógica e cronológica que faça
  sentido para um leitor interno da escola entender o caso do início
  ao fim sem precisar consultar outros documentos.

- Corrija rigorosamente todos os erros ortográficos, gramaticais,
  de concordância, pontuação e acentuação.

 Substitua linguagem informal e coloquial por linguagem profissional
  adequada ao ambiente escolar corporativo.

- Varie os pronomes e referências ao sujeito principal para evitar
  repetição excessiva.

═══════════════════════════════════════
 O QUE VOCÊ JAMAIS DEVE FAZER
═══════════════════════════════════════

- NUNCA invente, suponha ou acrescente fatos, nomes, situações
  ou informações que não estejam no texto original.

- NUNCA omita nenhum fato relevante do texto original, mesmo que
  pareça repetitivo, informal ou desnecessário.

- NUNCA adicione saudações, títulos, introduções, comentários
  ou explicações fora do texto reescrito.

- NUNCA use bullet points, listas ou formatações especiais.
  Apenas parágrafos de texto corrido.

- NUNCA inicie com frases como "Segue o texto melhorado" ou
  "Texto revisado". Comece diretamente pelo conteúdo.

- NUNCA adote tom formal excessivamente burocrático ou frio —
  o texto é interno entre colegas profissionais que se conhecem
  e trabalham juntos na mesma instituição.

- NUNCA finalize ou encerre o texto com análises, opiniões,
  lições, recomendações ou reflexões sobre o caso. O texto
  deve terminar com o encerramento institucional do caso,
  não com comentários editoriais ou conclusões pessoais.

- NUNCA interprete ou especule sobre os sentimentos ou
  motivações das pessoas. Registre apenas o que foi
  explicitamente dito ou demonstrado durante o atendimento.
  Exemplo do que NÃO fazer:
  "o que parece ter intensificado seu descontentamento"
  Exemplo correto:
  "a responsável demonstrou insatisfação crescente ao longo
  do atendimento"

═══════════════════════════════════════
CONTEXTO IMPORTANTE
═══════════════════════════════════════

Este texto é um registro interno do Colégio Objetivo.
Ele será lido exclusivamente por atendentes, coordenadores e diretores
da instituição para acompanhamento de casos de cancelamento de matrícula
e transferência de alunos.
O responsável pelo aluno NUNCA terá acesso a este documento.
Portanto, o tom deve ser direto, profissional e informativo —
como um coordenador experiente relatando um caso para a diretoria.`
                    },
                    {
                        role: 'user',
                        content: `Melhore este texto de registro escolar:\n\n${text}`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const improvedText = data.choices[0]?.message?.content?.trim();

        if (!improvedText) {
            throw new Error('Resposta vazia da IA');
        }

        return res.status(200).json({ improvedText });

    } catch (error) {
        console.error('Erro na API do Groq:', error);
        return res.status(500).json({ error: 'Não foi possível melhorar o texto agora' });
    }
}
