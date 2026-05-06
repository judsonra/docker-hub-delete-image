# Automação de Image Management no Docker Hub

Automação local com Playwright para apagar manifests do repositório `grupoitss/portalpm-backend` em lotes de 15, usando a página do Docker Hub filtrada por `manifest` e ordenada por `last_pulled asc`.

## Instalar dependências

```bash
npm install
npm run install:browsers
```

## Executar

Um lote:

```bash
npm run delete:dockerhub
```

Vários lotes:

```bash
REPEAT_COUNT=3 npm run delete:dockerhub
```

## Usar em outro repositório

Para executar a automação em outro repositório do Docker Hub, altere no arquivo `scripts/delete-dockerhub-images.js` os valores de `REPOSITORY_NAME` e `REPOSITORY_URL`.

Exemplo:

```js
const REPOSITORY_NAME = 'minha-org/meu-repositorio';
const REPOSITORY_URL =
  'https://hub.docker.com/repository/docker/minha-org/meu-repositorio/image-management?filters=manifest&sortField=last_pulled&sortOrder=asc';
```

## Fluxo

1. O navegador abre em modo visível.
2. Faça login manualmente no Docker Hub, se necessário.
3. Feche qualquer modal/overview inicial, se aparecer, e volte ao terminal para pressionar Enter.
4. O script acessa a página de image management do repositório.
5. Para cada repetição, ele seleciona a página atual e só continua se o botão mostrar exatamente `Preview and delete (15)`.
6. O script digita `delete`, clica em `Delete forever`, aguarda finalizar e clica em `Close`.

## Sessão persistente

O script usa um perfil persistente do Chromium em `.playwright/dockerhub-profile`.
Depois que você autenticar uma vez no Docker Hub, os cookies de sessão ficam gravados nesse perfil local.
As próximas execuções reutilizam esses cookies enquanto a sessão continuar válida.
Se a sessão expirar, execute novamente em modo visível, faça login manualmente e pressione Enter no terminal.
O perfil também guarda preferências locais do Docker Hub entre execuções.
Depois que você fechar o modal/overview inicial uma vez, o Docker Hub tende a reconhecer esse estado nas próximas execuções.

Para limpar tudo e simular um primeiro acesso novamente, apague a pasta `.playwright/dockerhub-profile`.

## Travas

- `REPEAT_COUNT` deve ser um inteiro positivo.
- O delete aborta se o contador for diferente de 15.
- O delete aborta se a página esperada, o checkbox, o modal ou os botões obrigatórios não forem encontrados.
- Nenhuma credencial é automatizada no código; a sessão autenticada fica salva no perfil local do navegador.
