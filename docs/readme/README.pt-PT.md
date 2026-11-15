# OpenPrint

**Um diretório aberto de estúdios e oficinas de impressão. Sem necessidade de registo ou moderadores.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Encontre um fabricante no mapa, verifique as suas capacidades e contacte-o diretamente. Se a sua oficina não estiver listada, adicione os contactos e serviços: a listagem aparecerá imediatamente. Guarde o link de gestão privado para editar ou eliminar a sua listagem mais tarde. O catálogo predefinido não tem contas, confirmação por e-mail ou fila de aprovação.

Execute OpenPrint com Node.js 24 e SQLite local. Vercel, Supabase, um fornecedor de e-mail, IA paga e autenticação de terceiros não são necessários. GitHub aloja o código fonte e as versões; um site partilhado que aceita envios necessita de um servidor API em funcionamento. Apenas as [GitHub Páginas](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) não conseguem executar o Node.js API ou manter as alterações dos visitantes.

## Funcionalidades do catálogo

- Pesquise por nome, cidade e tecnologia. O mapa inclui os locais correspondentes, independentemente da paginação da lista.
- Publique sem criar uma conta. Escolha um ponto no mapa ou introduza coordenadas; as publicações sem coordenadas continuam a ser pesquisáveis.
- Edite ou elimine um anúncio, juntamente com o seu link privado. As verificações de versão protegem contra edições conflitantes em diferentes separadores.
- Encontre os estúdios existentes antes de publicar. Nomes, cidades e endereços duplicados são rejeitados automaticamente.
- Importe um catálogo com a indicação da fonte. Os operadores não podem substituir as listagens publicadas por si próprios.
- Visualize OpenStreetMap blocos sem uma API chave. Os blocos são carregados quando um mapa é exibido, incluindo a página inicial predefinida.
- Escolha o idioma da interface no menu de idiomas. Leia o arquivo README completo no seu idioma através do índice de idiomas acima.

A publicação não verifica a propriedade do negócio nem a qualidade do serviço. Confirme o equipamento, as capacidades e os termos com o estúdio. Qualquer pessoa que possua o link de gestão privado pode controlar essa listagem. Mantenha-o privado; não existe recuperação por e-mail. Leia o [guia de autopublicação](../../docs/OPEN_CATALOG.md).

## Execute a sua própria instância

Instale o Node.js 24, clone este repositório e execute:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. A configuração predefinida `APP_MODE=catalog` não requer configuração de administrador ou utilizador. Configure `APP_URL`, HTTPS e as cópias de segurança utilizando o [guia de auto-hospedagem](../../docs/SELF_HOSTING.md). Docker O Compose também está disponível: `docker compose up --build -d`.

A implementação suportada consiste num único processo de aplicação com SQLite num disco local. A publicação automática e as quotas de pedidos limitam o uso indevido, sem necessidade de uma fila de moderação. Um endereço IP de escritório partilhado pode partilhar uma quota de publicação. Consulte [limites e comportamento do link de gestão](../../docs/OPEN_CATALOG.md) antes de abrir uma instância pública.

Utilize a [interface de linha de comandos de importação de catálogo](../../docs/CATALOG_IMPORT.md) para um conjunto de dados existente, após verificar os respetivos direitos. Os conjuntos de dados de instância, os ficheiros carregados e as cópias de segurança não estão incluídos no repositório ou nas imagens de contentor.

## Modo comunitário opcional e modo Neofab

Defina `APP_MODE=community` explicitamente para ativar projetos privados, orçamentos de fornecedores, a biblioteca de modelos e o Neofab Studio. Estes fluxos de trabalho utilizam as suas próprias contas e permissões. A mudança de modos preserva os dados armazenados. O modo de catálogo não expõe o histórico privado da comunidade através do seu API nem retoma trabalhos em fila de espera CAD.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) suporta documentos de especificações de fabrico com controlo de versões, listas de materiais e CAD declarativos com limites, com exportações para STEP/STL. CAD e IA são opcionais. As propostas de IA requerem revisão e um passo de candidatura separado; não publicam automaticamente pedidos nem criam geometria. CAM, código G e validação física do fabrico não estão implementados.

## Direitos de dados e privacidade

A licença de software MIT não concede direitos sobre registos comerciais importados. A simples atribuição não autoriza a cópia de dados do Google Maps, 2GIS, Yandex Maps ou de outras fontes. Verifique as permissões para armazenamento, publicação e redistribuição antes de utilizar um conjunto de dados. Consulte [os limites da proveniência e da revisão de dados](../../docs/DATA_PROVENANCE.md).

Os dados de contacto divulgados pelo utilizador são públicos; as chaves de gestão são privadas. Mantenha as bases de dados e as cópias de segurança fora de diretórios acessíveis ao público e forneça um contacto para pedidos de correção e remoção. Leia as informações sobre [privacidade](../../PRIVACY.md) e [segurança](../../SECURITY.md) antes da implementação.

## Desenvolvimento e tradução

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub As ações verificam os tipos, API e os fluxos de trabalho do navegador, e os CAD recipientes predefinidos e nativos. Os testes utilizam registos fictícios. As evidências exatas, a cobertura e os limites restantes são registados em [validação](../../docs/VALIDATION.md) e [âmbito do produto](../../docs/PRODUCT.md).

O ficheiro README em inglês é a referência para as versões traduzidas completas. O [índice de idiomas](../../docs/i18n/README.md) documenta os limites de manutenção e revisão da tradução. A localização da interface não traduz os conteúdos criados pelos utilizadores, o conteúdo do projeto ou todos os diagnósticos técnicos externos.

## Licenciamento e contribuições

O código original, a interface do utilizador, as ilustrações SVG, a documentação e o gerador paramétrico são disponibilizados sob a licença [MIT](../../LICENSE). As dependências mantêm as suas próprias licenças e avisos. Os modelos criados pelos utilizadores têm uma licença separada, escolhida pelos respetivos autores. Os textos dos perfis de demonstração e as descrições técnicas fictícias, bem como os três modelos de demonstração gerados, são disponibilizados sob a licença CC0; o gerador mantém a licença MIT. Consulte os [avisos de terceiros](../../THIRD_PARTY_NOTICES.md).

Esta implementação independente desenvolve a ideia de [3d-online.app](https://3d-online.app). Contas de produção originais, segredos, histórico privado do Git e ficheiros de utilizador não estão incluídos. O compilador MIT Neofab CAD adaptado mantém a sua [licença original e aviso de origem](../../cad-worker/NOTICE.md).

As contribuições podem incluir código, correções de tradução, melhorias na usabilidade, peças paramétricas de código aberto, verificações de instalação e feedback de oficinas reais. Comece com [CONTRIBUTING.md](../../CONTRIBUTING.md).
