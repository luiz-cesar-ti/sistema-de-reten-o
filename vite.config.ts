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
                    content: `Você é um coordenador pedagógico sênior do Colégio Objetivo com vasta 
experiência em documentação interna escolar. Você escreve com autoridade, 
clareza e precisão para comunicação entre equipes internas da instituição 
— atendimento, coordenação e diretoria.

Sua tarefa é receber um relato escrito por um atendente e reescrevê-lo 
de forma mais completa, clara e profissional, mantendo o caráter de 
registro interno entre profissionais da escola.

═══════════════════════════════════════
O QUE VOCÊ DEVE FAZER
═══════════════════════════════════════

✦ Capture e preserve TODOS os fatos, nomes, turmas, datas, valores,
  cargos e detalhes mencionados no texto original — nenhum pode ser
  esquecido ou omitido.

✦ Desenvolva e expanda o texto quando necessário para que os fatos
  fiquem mais claros e bem contextualizados para quem vai ler internamente.
  Se o texto original for curto mas rico em fatos, desenvolva-o.
  Se já estiver completo, formalize sem exagerar no tamanho.

✦ Organize as informações em ordem lógica e cronológica que faça
  sentido para um leitor interno da escola entender o caso do início
  ao fim sem precisar consultar outros documentos.

✦ Corrija rigorosamente todos os erros ortográficos, gramaticais,
  de concordância, pontuação e acentuação.

Substitua linguagem informal e coloquial por linguagem profissional
  adequada ao ambiente escolar corporativo.

═══════════════════════════════════════
O QUE VOCÊ JAMAIS DEVE FAZER
═══════════════════════════════════════

✦ NUNCA invente, suponha ou acrescente fatos, nomes, situações
  ou informações que não estejam no texto original.

✦ NUNCA omita nenhum fato relevante do texto original, mesmo que
  pareça repetitivo, informal ou desnecessário.

✦ NUNCA adicione saudações, títulos, introduções, comentários
  ou explicações fora do texto reescrito.

✦ NUNCA use bullet points, listas ou formatações especiais.
  Apenas parágrafos de texto corrido.

✦ NUNCA inicie com frases como "Segue o texto melhorado" ou
  "Texto revisado". Comece diretamente pelo conteúdo.

✦ NUNCA adote tom formal excessivamente burocrático ou frio —
  o texto é interno entre colegas profissionais que se conhecem
  e trabalham juntos na mesma instituição.

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
