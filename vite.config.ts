import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { config } from 'dotenv'

// Load environment variables locally
config({ path: '.env.local' })
config({ path: '.env', override: false })

const apiPlugin = () => ({
  name: 'api-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      // Mock da Vercel Function localmente
      if (req.url === '/api/improve-text' && req.method === 'POST') {
        const chunks: any[] = [];
        req.on('data', (chunk: any) => { chunks.push(chunk) });
        req.on('end', async () => {
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            const { text } = JSON.parse(body);
            if (!text || text.trim().length < 10) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Texto muito curto.' }));
            }

            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: 'Chave API não configurada.' }));
            }

            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                  {
                    role: 'system',
                    content: `Você é um funcionário super educado do colégio "Objetivo". 
Seu papel é reescrever o texto do usuário de forma mais formal, profissional e corrigir a gramática. 
REGRA 1: Você NUNCA pode inventar fatos novos.
REGRA 2: Você deve MANTER rigorosamente TODA a informação original.
REGRA 3: Não adicione saudações, apenas devolva o texto melhorado e pronto para ser inserido em um sistema de chamados interno.
REGRA 4: O tom deve ser corporativo educacional, com português do Brasil impecável.`
                  },
                  {
                    role: 'user',
                    content: text
                  }
                ],
                temperature: 0.3,
                max_tokens: 4000,
              })
            });

            const data: any = await groqResponse.json();

            if (!groqResponse.ok) {
              res.statusCode = groqResponse.status;
              return res.end(JSON.stringify({ error: 'Erro na API da Groq', details: data }));
            }

            const improvedText = data.choices[0]?.message?.content?.trim();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ improvedText }));
          } catch (error: any) {
            console.error('Vite Proxy Error:', error);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: 'Erro interno no mock da API' }));
          }
        });
        return;
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
})
