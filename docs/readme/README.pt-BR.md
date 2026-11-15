# OpenPrint

**Um diretório aberto de estúdios e oficinas de impressão. Não é necessário registro, e não há moderadores.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Encontre um fabricante no mapa, verifique suas capacidades e entre em contato diretamente. Se sua oficina não estiver listada, adicione seus contatos e serviços: a listagem aparecerá imediatamente. Salve o link de gerenciamento privado para editar ou excluir sua listagem posteriormente. O catálogo padrão não possui contas, confirmação por e-mail ou fila de aprovação.

Execute OpenPrint com Node.js 24 e SQLite local. Vercel, Supabase, um provedor de e-mail, IA paga e login de terceiros não são necessários. GitHub hospeda o código-fonte e as versões; um site compartilhado que aceita envios precisa de um servidor API em execução. Apenas [GitHub Páginas](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) não consegue executar o Node.js API ou manter as alterações dos visitantes.

## Recursos do catálogo

- Pesquise por nome, cidade e tecnologia. O mapa inclui os locais correspondentes, independentemente da paginação da lista.
- Publique sem criar uma conta. Escolha um ponto no mapa ou insira coordenadas; os anúncios sem coordenadas continuarão a ser pesquisáveis.
- Edite ou exclua um anúncio, incluindo seu link privado. A verificação de versão protege contra edições conflitantes em diferentes guias.
- Encontre os estúdios existentes antes de publicar. Nomes, cidades e endereços idênticos são rejeitados automaticamente.
- Importe um catálogo com a indicação da fonte. Os operadores não podem substituir as listagens publicadas por eles próprios.
- Visualize OpenStreetMap blocos sem uma API chave. Os blocos são carregados quando um mapa é exibido, incluindo a página inicial padrão.
- Escolha o idioma da interface no menu de idiomas. Leia o arquivo README completo em seu idioma acessando o índice de idiomas acima.

A publicação não verifica a propriedade do negócio ou a qualidade do serviço. Confirme os equipamentos, as capacidades e os termos diretamente com o estúdio. Qualquer pessoa que possua o link de gerenciamento privado pode controlar essa listagem. Mantenha-o em sigilo; não há recuperação por e-mail. Leia o [guia de autopublicação](../../docs/OPEN_CATALOG.md).

## Execute sua própria instância

Instale o Node.js 24, clone este repositório e execute:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. A configuração padrão `APP_MODE=catalog` não exige configuração de administrador ou usuário. Configure `APP_URL`, HTTPS e os backups usando o [guia de auto-hospedagem](../../docs/SELF_HOSTING.md). Docker O Compose também está disponível: `docker compose up --build -d`.

A configuração de implantação suportada é um único processo de aplicativo com SQLite em um disco local. A publicação automática e as cotas de solicitações limitam o uso indevido, sem a necessidade de uma fila de moderação. Um endereço IP de escritório compartilhado pode compartilhar uma cota de publicação. Consulte [limites e comportamento do link de gerenciamento](../../docs/OPEN_CATALOG.md) antes de abrir uma instância pública.

Use a [interface de linha de comando para importação de catálogo](../../docs/CATALOG_IMPORT.md) para um conjunto de dados existente, após verificar seus direitos de uso. Conjuntos de dados de instâncias, uploads e backups não são incluídos no repositório ou nas imagens de contêiner.

## Modo comunitário opcional e modo Neofab

Defina `APP_MODE=community` explicitamente para ativar projetos privados, orçamentos de fornecedores, a biblioteca de modelos e o Neofab Studio. Esses fluxos de trabalho usam suas próprias contas e permissões. A troca de modos preserva os dados armazenados. O modo de catálogo não expõe o histórico privado da comunidade por meio de seu API nem retoma trabalhos em fila CAD.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) oferece suporte a documentos de projeto de fabricação com controle de versão, listas de materiais e declarações CAD com exportação para STEP/STL. CAD e IA são opcionais. As propostas de IA exigem análise e uma etapa de aplicação separada; elas não publicam automaticamente pedidos nem geram geometria. CAM, código G e validação física da fabricação não estão implementados.

## Direitos e privacidade dos dados

A licença de software MIT não concede direitos sobre registros comerciais importados. A simples atribuição não autoriza a cópia de dados do Google Maps, 2GIS, Yandex Maps ou de outras fontes. Verifique as permissões para armazenamento, publicação e redistribuição antes de usar um conjunto de dados. Consulte [as diretrizes sobre a origem dos dados e os limites da revisão](../../docs/DATA_PROVENANCE.md).

Os dados de contato divulgados pelo próprio usuário são públicos; as chaves de gerenciamento são privadas. Mantenha os bancos de dados e os backups fora de diretórios acessíveis publicamente e forneça um contato para solicitações de correção e remoção. Leia as informações sobre [privacidade](../../PRIVACY.md) e [segurança](../../SECURITY.md) antes da implementação.

## Desenvolvimento e tradução

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub As ações verificam os tipos, API e os fluxos de trabalho do navegador, e os CAD contêineres padrão e nativos. Os testes usam registros fictícios. Evidências exatas, cobertura e limites restantes são registrados em [validação](../../docs/VALIDATION.md) e [escopo do produto](../../docs/PRODUCT.md).

O arquivo README em inglês é a referência para as versões traduzidas completas. O [índice de idiomas](../../docs/i18n/README.md) documenta os limites de manutenção e revisão da tradução. A localização da interface não traduz as listagens criadas pelos usuários, o conteúdo do projeto ou todos os diagnósticos técnicos externos.

## Licenciamento e contribuições

O código original, a interface do usuário, as ilustrações SVG, a documentação e o gerador paramétrico são [licenciados sob MIT](../../LICENSE). As dependências mantêm suas próprias licenças e avisos. Os modelos criados pelos usuários têm uma licença separada, escolhida por seus autores. Os textos fictícios de demonstração, tanto dos perfis quanto das especificações técnicas, assim como os três projetos de demonstração gerados, são dedicados sob CC0; o gerador permanece sob MIT. Consulte os [avisos de terceiros](../../THIRD_PARTY_NOTICES.md).

Esta implementação independente desenvolve a ideia de [3d-online.app](https://3d-online.app). As contas originais de produção, as chaves de segurança, o histórico privado do Git e os arquivos do usuário não estão incluídos. O compilador MIT Neofab CAD adaptado mantém sua [licença original e aviso de origem](../../cad-worker/NOTICE.md).

As contribuições podem incluir código, correções de tradução, melhorias na usabilidade, peças paramétricas de código aberto, verificações de instalação e feedback de oficinas reais. Comece com [CONTRIBUTING.md](../../CONTRIBUTING.md).
