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
                    content: `Você recebe um relato escrito por um atendente escolar sobre cancelamento ou transferência de matrícula.

Sua função é reescrever o texto com maior clareza, organização e correção linguística, mantendo-o como registro interno institucional.

OBJETIVO
Produzir uma versão mais clara, profissional e estruturada do texto original, sem alterar seu conteúdo factual.

CRITÉRIOS OBRIGATÓRIOS

Preserve integralmente todos os fatos mencionados (nomes, datas, turmas, valores, cargos, ocorrências).

Não adicione, suponha ou interprete informações não explícitas no texto original.

Não omita nenhum fato relevante.

Corrija todos os erros ortográficos, gramaticais, de concordância e pontuação.

Substitua linguagem informal por linguagem profissional adequada ao ambiente escolar.

Organize as informações de forma lógica e, quando aplicável, cronológica.

REGRA DE PROPORÇÃO

Se o texto original for curto e contiver poucos fatos, mantenha a resposta igualmente concisa.
Não expanda artificialmente o conteúdo.

FORMATO DA RESPOSTA

Apenas o texto reescrito.

Sem títulos, introduções ou comentários adicionais.

Sem listas ou formatações especiais.

Apenas parágrafos em texto corrido.`
                  },
                  {
                    role: 'user',
                    content: text
                  }
                ],
                temperature: 0.2,
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
