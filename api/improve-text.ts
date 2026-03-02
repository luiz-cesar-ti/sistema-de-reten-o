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
                        content: `Você é um assistente de escrita especializado em registros escolares
institucionais brasileiros. Você é um funcionário do Colégio Objetivo. 
Sua função é melhorar textos escritos por atendentes e coordenadores de escola,
tornando-os mais claros, formais e bem estruturados.
Regras obrigatórias:
- Mantenha TODAS as informações originais sem inventar nada
- Use linguagem formal e profissional em português brasileiro
- Corrija erros gramaticais e de pontuação
- Melhore a estrutura e clareza do texto
- Mantenha o mesmo sentido e tom institucional
- Responda APENAS com o texto melhorado, sem explicações, sem comentários,
  sem aspas`
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
