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
            content: `Você recebe um relato escrito por um atendente escolar sobre cancelamento ou transferência de matrícula.

Sua função é reescrever o texto com maior clareza, organização e correção linguística, mantendo-o como registro interno institucional.

OBJETIVO
Produzir uma versão mais clara, profissional e bem estruturada do texto original, preservando integralmente seu conteúdo factual.

CRITÉRIOS OBRIGATÓRIOS

Preserve todos os fatos mencionados (nomes, datas, turmas, valores, cargos, situações e ocorrências).

Não adicione, suponha ou interprete informações que não estejam explicitamente no texto original.

Não omita nenhum fato relevante.

Corrija completamente erros ortográficos, gramaticais, de concordância e pontuação.

Substitua linguagem informal por linguagem profissional clara e natural, adequada ao ambiente escolar.

Evite excesso de formalismo ou termos excessivamente rebuscados. O texto deve soar profissional, mas humano e fluido.

Organize as informações de forma lógica e, quando aplicável, cronológica.

REGRA DE PROPORÇÃO

Se o texto original for curto e contiver poucos fatos, mantenha a resposta igualmente concisa.
Não expanda artificialmente o conteúdo.
Um fato deve gerar uma frase melhorada, não múltiplas frases com acréscimos desnecessários.

FORMATO DA RESPOSTA

Forneça apenas o texto reescrito.

Não inclua títulos, saudações, explicações ou comentários adicionais.

Não utilize listas ou formatações especiais.

Escreva apenas em parágrafos de texto corrido.

Se houver ambiguidade no texto original, mantenha a ambiguidade sem tentar esclarecê-la.`
          },
          {
            role: 'user',
            content: text
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
