import { defineConfig, type ViteDevServer, type Connect } from 'vite';
import react from '@vitejs/plugin-react'
import { config } from 'dotenv'

// Load environment variables locally
config({ path: '.env.local' })
config({ path: '.env', override: false })

const apiPlugin = () => ({
  name: 'api-plugin',
  configureServer(server: ViteDevServer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.middlewares.use(async (req: Connect.IncomingMessage, res: any, next: Connect.NextFunction) => {
      // Mock da Vercel Function localmente
      if (req.url === '/api/improve-text' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => { chunks.push(chunk) });
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
Produzir uma versão mais clara, profissional e bem estruturada do texto original, preservando integralmente seu conteúdo factual.

CRITÉRIOS OBRIGATÓRIOS

Preserve todos os fatos mencionados (nomes, datas, turmas, valores, cargos, situações e ocorrências).

Não adicione, suponha ou interprete informações que não estejam explicitamente no texto original.

Não adicione palavras de ênfase, opinião ou julgamento que não
estejam no texto original, como: "infelizmente", "enfatizando",
"exclusivamente", "claramente", "obviamente", "lamentavelmente"
ou similares.

Não repita informações já mencionadas anteriormente no mesmo
texto reescrito, mesmo que estejam em parágrafos diferentes.

Não omita nenhum fato relevante.

Responda exclusivamente em português brasileiro. 
Não utilize caracteres, palavras ou expressões de nenhum 
outro idioma em nenhuma circunstância.

Corrija completamente erros ortográficos, gramaticais, de concordância e pontuação.

Substitua linguagem informal por linguagem profissional clara e natural, adequada ao ambiente escolar.

Evite excesso de formalismo ou termos excessivamente rebuscados. O texto deve soar humano e fluido.

Organize as informações de forma lógica e, quando aplicável, cronológica.

Estruture o texto em parágrafos que reflitam mudanças de assunto ou etapa do relato (reclamação, tentativas de resolução, decisão final).

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
                ],
                temperature: 0.2,
                max_tokens: 4000,
              })
            });

            const data = (await groqResponse.json()) as { choices?: { message?: { content?: string } }[] };

            if (!groqResponse.ok) {
              res.statusCode = groqResponse.status;
              return res.end(JSON.stringify({ error: 'Erro na API da Groq', details: data }));
            }

            const improvedText = data.choices?.[0]?.message?.content?.trim();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ improvedText }));
          } catch (error) {
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor': ['lucide-react', 'framer-motion', 'react-hot-toast'],
          'chart-vendor': ['recharts']
        }
      }
    }
  }
})
