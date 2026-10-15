# 🚀 ROADMAP: Próximas Features e Melhorias para o MOBATest v0

Este documento define o plano de desenvolvimento e evolução para a versão **v0** do projeto **MOBATest**, com o objetivo de transformá-la em uma arena MOBA 1x1 robusta, divertida e extremamente otimizada (alcançando estáveis **120 FPS+ em PCs de entrada** e **60 FPS+ em celulares**).

A base limpa do **v0** será utilizada para implementar as mecânicas de forma sólida, evitando os problemas de arquitetura da v1.

---

## 📌 Status Atual da Versão v0
Atualmente, o protótipo **v0** é uma base minimalista contendo:
*   Mecânicas básicas de entidade (`Character` e `Projectile`).
*   Um boneco de testes estático (`Dummy`) para simulação de recebimento de dano.
*   Lógica simples de clique para movimentação e disparo básico.
*   Cenário simplificado com grid dourado sobre plano verde.

---

## 🎮 Proposta de Controles Finais (Caitlyn)

Para aproximar a jogabilidade da experiência clássica do League of Legends em PC:

| Ação | Atalho / Entrada | Comportamento Esperado |
| :--- | :--- | :--- |
| **Movimentação** | Clique Direito no chão | Move a Caitlyn até o ponto clicado com rotação suave em direção ao destino. |
| **Ataque Básico** | Clique Direito no inimigo | Persegue o alvo até entrar no alcance de ataque e inicia disparos automáticos. |
| **Focar Câmera** | `Espaço` | Centraliza instantaneamente a visão da câmera na Caitlyn. |
| **Destravar Câmera** | `Y` | Alterna entre câmera travada no personagem e câmera livre (rola ao encostar nas bordas da tela). |
| **Zoom** | Roda do Mouse | Aproxima ou afasta a câmera isométrica. |
| **Q (Piltover Peacemaker)**| Tecla `Q` | Dispara um laser linear largo de alto dano físico na direção atual do cursor. |
| **W (Yordle Snap Trap)** | Tecla `W` | Posiciona uma armadilha no chão. Se o inimigo pisar, fica enraizado por 1.5s e sofre dano. |
| **E (9-Caliber Net)** | Tecla `E` | Dispara uma rede que causa lentidão ao inimigo e arremessa a Caitlyn para trás (Dash de recuo). |
| **R (Ace in the Hole)** | Tecla `R` | Canaliza uma mira laser no Master Yi por 2 segundos e dispara um projétil teleguiado inevitável de dano massivo. |
| **Menu de Jogo** | `ESC` | Abre opções de áudio, qualidade gráfica e ativação do modo Auto-Play (Simulação). |

---

## 🚀 Plano de Evolução e Próximas Features

### ⚡ Fase 1: Performance Extrema e Otimização Mobile (FPS 120+)
Para atender aos requisitos rígidos de alta performance e portabilidade mobile futuras:
*   [ ] **Zero Garbage Collection nos Loops:** 
    *   Reescrever a física e movimentação no `update()` de forma que nenhuma estrutura matemática do Three.js (`Vector3`, `Quaternion`, `Matrix4`, `Euler`) seja instanciada usando `new`.
    *   Instanciar todas as variáveis temporárias de vetor uma única vez como propriedades de cache privado (ex: `static tempDir = new THREE.Vector3()`) para zerar engasgos (stutters) do Garbage Collector.
*   [ ] **Controle de Resolução e Render:**
    *   Manter `devicePixelRatio` travado estritamente em `1.0` por padrão, evitando renderizações 2K/4K ocultas em celulares de alta densidade.
*   [ ] **Otimização Gráfica:**
    *   Substituir a filtragem pesada de sombras (`PCFSoftShadowMap`) por filtragem bilinear rápida (`PCFShadowMap`) ou desativar sombras em configurações de baixo desempenho.
    *   Simplificar shaders de materiais dos personagens e terreno para rodarem fluidamente em WebGL mobile.

---

### ⚔️ Fase 2: Gameplay e Mecânicas de Combate (Feeling de LoL)
Trazer a Caitlyn para a v0 com mecânicas sólidas e limpas:
*   [ ] **Habilidades Completas da Caitlyn:**
    *   Implementar o disparo linear e penetrante do **Q**.
    *   Criar o sistema de armadilhas físicas do **W** no cenário com detecção de colisão circular.
    *   Programar o dash de recuo do **E** aplicando um vetor de velocidade oposto temporário (Physics-based movement).
    *   Estruturar o estado `CASTING` de canalização e linha guia do **R** conectando o peito da Caitlyn ao alvo.
*   [ ] **Sistema de Projéteis Otimizado:**
    *   Criar um gerenciador único de projéteis (Object Pooling) para evitar criação/destruição constante de meshes na memória.
    *   Suporte a projéteis lineares (skillshots) e projéteis teleguiados (homing).

---

### 🤖 Fase 3: Inteligência Artificial Avançada (Master Yi)
Criar uma IA desafiadora e fluida para o oponente 1x1:
*   [ ] **IA de Combate do Master Yi:**
    *   **Ataque e Perseguição:** Perseguir a Caitlyn caso esteja no campo de visão, alternando entre ataques básicos e habilidades.
    *   **Alpha Strike (Q):** Usar o Q para ficar invulnerável, causar dano e fechar a distância contra Caitlyn quando ela tentar se afastar.
    *   **Meditate (W):** Entrar em modo de canalização de cura se a vida cair abaixo de 25%, mitigando 50% de todo o dano recebido durante a animação.
    *   **Highlander (R):** Ativar a ult para ganhar imunidade a lentidão e velocidade massiva ao entrar em combate direto.
*   [ ] **IA de Micro-Desvios (Esquiva):**
    *   Fazer o Master Yi detectar a trajetória de projéteis lineares (Q da Caitlyn) e dar passos laterais (perpendiculares) para desviar.
    *   Fazer a IA desviar ativamente das coordenadas das armadilhas do W posicionadas no chão.

---

### 🏟️ Fase 4: Elementos de Arena 1x1
Construir o ecossistema competitivo de MOBA ao redor da rota:
*   [ ] **Spawner de Minions (Tropas):**
    *   Criar spawner cíclico a cada 20 segundos.
    *   Dividir tropas em combatentes corpo a corpo (melees) com alto HP e tropas de ataque à distância (ranged).
    *   Lógica para minions atacarem outros minions, priorizarem torres ou focarem campeões se estes atacarem seus aliados.
*   [ ] **Torres Defensivas com Aggro Dinâmico:**
    *   Definir áreas circulares de perigo.
    *   A torre ataca o primeiro inimigo que entrar no raio.
    *   **Sistema de Proteção:** Se a Caitlyn atacar o Master Yi dentro do raio da torre inimiga, a torre deve mudar o foco imediatamente para a Caitlyn.
*   [ ] **Sistema de Experiência, Level Up e Atributos:**
    *   Acúmulo de EXP ao abater minions ou inimigos.
    *   Level Up com aumento de status base e pontos para distribuir nas skills (Q, W, E, R).
*   [ ] **Sistema de Loja e Itens (Shop):**
    *   Interface visual de compras acessível na área da base aliada.
    *   Itens compráveis com ouro passivo e de abates (ex: itens de Velocidade de Ataque, Dano Físico e Roubo de Vida).

---

### 🎨 Fase 5: Interface (UI), Imersão e Áudio
Melhorar o feedback do jogo para torná-lo profissional:
*   [ ] **Barras de Vida Flutuantes Otimizadas:**
    *   Interface de HP e Mana flutuante sobre as cabeças das entidades usando overlays HTML projetados em coordenadas 3D para 2D.
    *   Utilização de `translate3d` CSS para evitar gargalos de renderização (Layout Reflows).
*   [ ] **Indicadores Visuais de Mira (Skillshots):**
    *   Exibir decalques de mira no chão (retângulos para trajetórias lineares e círculos para raios de ação) ao segurar as teclas de skill.
*   [ ] **Minimapa Dinâmico:**
    *   Desenhar um canvas 2D no canto da tela atualizando a posição em tempo real do jogador, inimigos, minions e torres.
*   [ ] **Efeitos de Áudio (SFX):**
    *   Implementação de sons de impacto de projéteis, passos, conjuração de magias e alertas de abate.
