# Revisão de manutenção das skills

Revisão de 2026-11-05. A classificação usa o conteúdo completo da skill, incluindo
`SKILL.md`, regras, referências e scripts. Depender de uma biblioteca, mencionar
uma versão ou possuir `llms.txt` upstream não basta para depreciar uma skill.

## Critério de decisão

1. **Manter** quando houver instruções personalizadas, escolhas de implementação,
   best practices, regras do/don't ou um workflow acionável. Uma skill mista,
   com documentação e regras, permanece inteira nesta revisão. Não extrair nem
   reescrever as regras automaticamente.
2. **Investigar** quando a skill apenas reproduzir documentação: APIs, opções,
   exemplos básicos ou receitas que não adicionam orientação própria.
3. Para cada candidata documental, verificar, nesta ordem:
   - O site oficial oferece `llms.txt`? Confirmar que é texto útil, não uma página
     HTML com status 200; seguir links relevantes e conferir a cobertura.
   - Caso contrário, usar `opensrc` para obter/localizar o repositório canônico
     e procurar uma skill oficial, incluindo arquivos de distribuição e versão.
   - Caso contrário, pesquisar issues, discussions e PRs abertos sobre skills,
     instruções para agentes, documentação para LLMs e empacotamento/versionamento.
     Pesquisar além do termo TanStack Intent; registrar URLs e estado atual.
4. Registrar em qual etapa a busca terminou. Uma proposta aberta não equivale a
   uma skill publicada. Sem substituto disponível, manter a skill e registrar o
   acompanhamento; não anunciar uma migração concluída.
5. Para uma aposentadoria confirmada, registrar razão, fonte oficial, cobertura,
   limites de versão e revisão histórica em `skills/deprecated/README.md`.
   Remover os arquivos ativos, referências do README, categorias e registros de
   sync aplicáveis; regenerar e validar o catálogo do CLI.

Um `llms.txt` com caminho `latest` não acompanha necessariamente a versão instalada.
Intent acompanha a versão do pacote somente quando aquele release distribui
skills. Orientações autorais como shadcn-dream são preservadas em ambos os casos.

## Resultado

A retirada anterior de 38 skills foi revista: **37 mantidas e 1 aposentada**.
As demais skills do catálogo permanecem ativas. A tabela abaixo registra a
evidência para as 37 que seriam removidas; os caminhos apontam para conteúdo
preservado, não apenas para descrições do catálogo.

| Skill mantida | Evidência e motivo |
| --- | --- |
| [ai-sdk](../skills/ai-sdk/SKILL.md) | Instruções para consultar documentação e código da versão instalada; seleção de modelos e composição de agentes. |
| [better-auth](../skills/better-auth/SKILL.md) | Tabela DO/DON’T, regras de sessão, cookies e configuração de modelos. |
| [composition-patterns](../skills/composition-patterns/SKILL.md) | Regras de composição, eliminação de boolean props e organização do estado. |
| [drizzle-orm](../skills/drizzle-orm/references/migrations.md) | Boas práticas de migrations: snapshots, mudanças incrementais e restrição de push em produção. |
| [elysia](../skills/elysia/SKILL.md) | Preferência pela biblioteca Standard Schema já adotada e seção Best Practice. |
| [fastify](../skills/fastify/SKILL.md) | Princípios de encapsulamento, plugins, schemas e dependências mínimas. |
| [hono](../skills/hono/SKILL.md) | Best Practices: organização por feature, inferência de tipos, validação e testes. |
| [kanpeki](../skills/kanpeki/SKILL.md) | Regras de composeRenderProps, arquitetura de componentes e Common Pitfalls. |
| [motion](../skills/motion/SKILL.md) | Quando usar ou evitar Motion, regras de AnimatePresence e receitas de performance. |
| [nestjs](../skills/nestjs/SKILL.md) | Critical Rules, Always Do/Never Do e regras de arquitetura e DI. |
| [next-best-practices](../skills/next-best-practices/SKILL.md) | RSC boundaries, waterfalls, imagens e escolhas de runtime. |
| [next-cache-components-adoption](../skills/next-cache-components-adoption/SKILL.md) | Procedimento de migração com pré-condições e verificação em runtime. |
| [next-cache-components-optimizer](../skills/next-cache-components-optimizer/SKILL.md) | Loops de diagnóstico, refatoração e exigência de melhoria visível. |
| [next-upgrade](../skills/next-upgrade/SKILL.md) | Workflow de upgrade incremental, codemods primeiro e validação final. |
| [nuqs](../skills/nuqs/SKILL.md) | Modelagem do contrato da URL, seleção de parsers e verificação das fronteiras. |
| [paraglide-js](../skills/paraglide-js/SKILL.md) | Regras de integração e isolamento de locale em SSR. |
| [playwright](../skills/playwright/SKILL.md) | Core Workflow, MUST DO/MUST NOT e Common Gotchas. |
| [prisma](../skills/prisma/references/advanced-patterns.md) | Best Practices, instância única de PrismaClient e prevenção de esgotamento de conexões. |
| [react-best-practices](../skills/react-best-practices/SKILL.md) | Regras priorizadas de performance, waterfalls, bundle e renderização. |
| [react-email](../skills/react-email/SKILL.md) | Behavioral Guidelines, restrições de clientes de email e padrões de componentes. |
| [react-hook-form-zod](../skills/react-hook-form-zod/SKILL.md) | Validação no servidor, colocação de erros, performance e prevenção de falhas comuns. |
| [react-native-skills](../skills/react-native-skills/SKILL.md) | Regras priorizadas para listas, animação, navegação e estado. |
| [shadcn](../skills/shadcn/SKILL.md) | Princípios de composição, cores semânticas e regras de estrutura, estilo e formulários. |
| [shadcn-dream](../skills/shadcn-dream/SKILL.md) | Skill autoral: adapta shadcn ao estilo pessoal, com regras próprias de cva, Props e exports. |
| [tanstack-ai](../skills/tanstack-ai/references/tools.md) | Best Practices para ferramentas: responsabilidade única, erros, aprovação e inferência. |
| [tanstack-db](../skills/tanstack-db/SKILL.md) | Core Guidelines sobre schemas, mutations e atualização de estado. |
| [tanstack-form](../skills/tanstack-form/SKILL.md) | Critical Rules, Always Do/Never Do e regras de validação e composição. |
| [tanstack-pacer](../skills/tanstack-pacer/SKILL.md) | Regras de escolha de hooks, execução e Always Do/Never Do. |
| [tanstack-query](../skills/tanstack-query/SKILL.md) | Regras de query keys, cache, mutations e Always Do/Never Do. |
| [tanstack-react-store](../skills/tanstack-react-store/SKILL.md) | Best Practices para seletores, shallow e redução de re-renders. |
| [tanstack-router](../skills/tanstack-router/SKILL.md) | Regras de type safety, rotas, loaders e parâmetros de busca. |
| [tanstack-start](../skills/tanstack-start/SKILL.md) | Regras de server functions, validação de entradas e fronteiras cliente/servidor. |
| [tanstack-table](../skills/tanstack-table/SKILL.md) | Regras para referências estáveis, modelos de linhas e Always Do/Never Do. |
| [tanstack-virtual](../skills/tanstack-virtual/SKILL.md) | Critical Rules para medição, dimensões e chaves estáveis. |
| [tauri](../skills/tauri/SKILL.md) | Core Principles e regras de comandos, ownership async e permissões. |
| [zod](../skills/zod/SKILL.md) | Regras explícitas sobre APIs de Zod 4 e padrões de Zod 3 a evitar. |
| [zustand](../skills/zustand/SKILL.md) | Critical rules para seletores, ordem de middleware e persistência. |

### Documentação pura: tanstack-hotkeys

O conteúdo principal e `references/react-api.md` descrevem hooks, tipos, opções
e exemplos de composição. Não foi identificado um conjunto próprio de decisões
ou de best practices para preservar. O `llms.txt` oficial resolveu o primeiro
passo da investigação:

- [Índice oficial](https://tanstack.com/hotkeys/latest/llms.txt): HTTP 200, text/plain.
- [Overview](https://tanstack.com/hotkeys/latest/docs/overview.md): HTTP 200, text/markdown.
- [React quick start](https://tanstack.com/hotkeys/latest/docs/framework/react/quick-start.md): HTTP 200, text/markdown.
- [React hotkeys](https://tanstack.com/hotkeys/latest/docs/framework/react/guides/hotkeys.md): HTTP 200, text/markdown.

Por isso, não foi necessário buscar skills no repositório nem propostas abertas.
Isso não afirma nem nega a existência de suporte a Intent nesse pacote.
A migração e a revisão histórica estão no [registro de aposentadoria](../skills/deprecated/README.md).

### Linguagens, ferramentas e workflows

Rust, SwiftUI, Docker, Nginx e os workflows de engenharia continuam ativos.
As ferramentas também não foram depreciadas por serem distribuídas via npm:
Bun tem orientações de segurança de shell e escolha de FFI para produção; pnpm
e Turborepo contêm best practices; Denji organiza workflows de ícones;
agent-browser já orienta o carregamento de instruções pela versão instalada e
mantém referências operacionais. A classificação é pelo valor das instruções,
não pelo mecanismo de distribuição da ferramenta.
