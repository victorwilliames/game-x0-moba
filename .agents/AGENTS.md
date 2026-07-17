# Custom Rules for MOBATest

## Performance Extrema e Portabilidade Mobile (120 FPS+)

1. **Prioridade Máxima**: Alto desempenho, baixo consumo de CPU/GPU e tempo de carregamento rápido são os pilares de desenvolvimento deste projeto.
2. **Meta de FPS**: 120 FPS+ estáveis em PCs de entrada, e taxa estável de 60 FPS+ em celulares de entrada (futura portabilidade).
3. **Restrições de Memória (Garbage Collection Zero)**:
   * Proibido instanciar objetos matemáticos do Three.js (`new THREE.Vector3()`, `new THREE.Quaternion()`, `new THREE.Matrix4()`, etc.) dentro do loop principal (`update()`, `animate()`). 
   * Todos os objetos auxiliares devem ser instanciados uma única vez na inicialização ou no construtor da classe como variáveis privadas ou estáticas de cache (ex: `tempDir`, `tempTarget`).
4. **Restrições Gráficas (Mobile-Friendly)**:
   * **Device Pixel Ratio**: Manter em `1.0` por padrão. Não usar pixels dinâmicos pesados que forçam renderizações em altas resoluções (2K/4K) em fragment shaders.
   * **Sombras**: Evitar sombras suaves e lentas (`PCFSoftShadowMap`). Usar filtragem bilinear por hardware (`PCFShadowMap`) ou desativar em configurações de baixo desempenho.
   * **Névoa (Fog)**: Evitar o uso desnecessário de névoas de fragment shader se elas afetarem o fillrate da GPU.
   * **Modelos Low-Poly**: Priorizar o carregamento e instanciação otimizada de modelos, descartando vértices desnecessários e reduzindo a contagem de ossos/skinning na CPU.
