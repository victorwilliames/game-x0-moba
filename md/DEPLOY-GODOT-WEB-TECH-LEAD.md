# 📋 Relatório Técnico & Guia de Deploy Web: Three.js & Godot 4 no GitHub Pages

**Para:** Tech Lead / ChatGPT  
**De:** Victor Williames & Antigravity  
**Contexto:** Transição do Protótipo Web (Three.js/Vite) para a versão recriada em **Godot 4 (CLI/GDScript)** e estratégia de publicação na Web.

---

## 1. 📌 Resumo Executivo & Contexto

1. **Protótipo Inicial (Three.js + Vite):**
   * Foi testado e publicado com sucesso no **GitHub Pages** de forma 100% automatizada via **GitHub Actions**:  
     👉 **URL Ativa:** [https://victorwilliames.github.io/game-x0-moba/](https://victorwilliames.github.io/game-x0-moba/)
   * O pipeline compila TypeScript e minifica os bundles, copiando os modelos 3D (`.glb`) para um servidor estático que o navegador do cliente renderiza em WebGL.

2. **Diretriz de Navegador (Decisão Fechada):**
   * 🔥 **FOCO 100% EM GOOGLE CHROME MODERNO (Chromium):** Não gastar tempo nem energia com compatibilidade de navegadores antigos ou Safari/iOS WebKit.
   * **Vantagens Técnicas no Chrome:**
     * Suporte nativo pleno a **WebAssembly SIMD** (instruções vetoriais aceleradas por CPU no V8 para a física/matemática do Godot).
     * **WebGL 2.0** sem limitações de extensões de textura e buffers.
     * Suporte perfeito e estável à **Pointer Lock API** e **Fullscreen API** (essenciais para controles estilo LoL).
     * Zero necessidade de polyfills legados ou fallbacks pesados.

3. **Fase Atual:**
   * O projeto está sendo **recriado em Godot 4** via linha de comando (`godot --headless` / CLI).
   * **Decisão de fluxo:** O desenvolvimento atual será mantido **estritamente local** durante as etapas de implementação e iteração.
   * **Meta de Lançamento/Playtest:** Ao final dos marcos de entrega, a versão Web exportada do Godot será publicada no GitHub Pages para testes públicos diretos no navegador (PC e Mobile Chrome).

---

## 2. ⚙️ Como o Godot 4 Funciona na Web (vs. Web Stack Tradicional)

O Godot **não** utiliza Node.js, Vite, npm ou Webpack. A engine compila a lógica (C++/GDScript) e os recursos diretamente para tecnologias nativas de navegador:

```text
Projeto Godot 4 (.godot, scenes, gdscripts)
          │
          ▼ [godot --export-release "Web"]
┌────────────────────────────────────────────────────────┐
│  Arquivos Gerados na Pasta de Build:                  │
│  ├── index.html       -> Wrapper visual / Canvas       │
│  ├── index.js         -> Inicializador / Glue Code     │
│  ├── index.wasm       -> Engine + Lógica em WebAssembly │
│  └── index.pck        -> Pacote binário de assets 3D   │
└────────────────────────────────────────────────────────┘
```

* **Processamento 100% Client-Side:** Assim como o Three.js, o servidor de hospedagem apenas entrega os arquivos estáticos. Todo o loop de jogo, física e gráficos rodam na GPU e CPU do dispositivo do usuário.

---

## 3. ⚠️ Pontos Críticos do Godot 4 na Web (Atenção do Tech Lead)

Para garantir que a build do Godot 4 rode liso no GitHub Pages sem erros ou telas pretas:

### A. Renderizador Obrigatório: `Compatibility` (WebGL 2.0)
* No Godot 4, o backend gráfico padrão para Web **deve ser o `Compatibility`**.
* Os modos `Forward+` e `Mobile` (baseados em Vulkan) não têm suporte amplo em navegadores convencionais.
* Configurar no `project.godot`:
  ```ini
  [rendering]
  renderer/rendering_method="gl_compatibility"
  renderer/rendering_method.web="gl_compatibility"
  ```

### B. O Desafio dos Cabeçalhos HTTP (SharedArrayBuffer & COOP/COEP)
O Godot 4 foi desenhado nativamente com suporte a multithreading no WebAssembly. No entanto, navegadores exigem dois cabeçalhos de segurança estritos para habilitar threads:
* `Cross-Origin-Opener-Policy: same-origin`
* `Cross-Origin-Embedder-Policy: require-corp`

Como o **GitHub Pages é um CDN estático simples que não permite editar cabeçalhos HTTP**, existem **duas soluções validadas**:

1. **Abordagem 1 (Recomendada para Web/GitHub Pages): Export Single-Thread**
   * No preset de exportação Web do Godot, desmarque a opção **"Thread Support"** (ou configure `threads=false`).
   * *Vantagem:* Roda direto em qualquer navegador e no GitHub Pages sem precisar de nenhuma configuração especial.

2. **Abordagem 2: `coi-serviceworker` (Se precisar de Threads)**
   * Caso precise de multithreading no WebAssembly, basta incluir o arquivo leve `coi-serviceworker.min.js` junto do `index.html`.
   * Esse script registra um Service Worker no cliente que intercepta as requisições e simula os cabeçalhos COOP/COEP necessários.

---

## 4. 🚀 Estratégia de Deploy para a Versão Final

Quando chegarmos na etapa de lançar a versão de testes:

### Opção A: Deploy Manual da Build
1. Rodar localmente o comando de exportação do Godot:
   ```bash
   godot --headless --export-release "Web" build/web/index.html
   ```
2. Mover a pasta gerada para o repositório ou branch `gh-pages`.
3. O GitHub Pages serve os arquivos instantaneamente.

### Opção B: Deploy Automatizado via GitHub Actions (CI/CD)
Podemos usar o pipeline do GitHub Actions que baixa o binário oficial do Godot CLI headless na nuvem, exporta o projeto e faz o deploy no GitHub Pages a cada commit de release.

Exemplo de workflow:
```yaml
name: Deploy Godot 4 Web to GitHub Pages

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  export_web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Godot
        uses: barichello/godot-ci@v4.3
        with:
          godot-version: 4.3
      - name: Export Web
        run: |
          mkdir -p build/web
          godot --headless --verbose --export-release "Web" build/web/index.html
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
        with:
          artifact_name: github-pages
```

---

## 5. 🎯 Próximos Passos
* **Ambiente Atual:** Foco total no desenvolvimento local em Godot CLI (lógica, movimentação, kiting, arena e física).
* **Homologação:** O pipeline e o domínio do GitHub Pages já estão configurados e funcionais no repositório caso queiramos utilizá-los no momento do release.
