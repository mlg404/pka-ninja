# PKA Ninja

Tracker de economia do market do PokeAlliance, no mesmo formato do PXG Ninja: mediana, spread, busca e listagens paginadas.

Ícones e ids de item do cliente não entram. O catálogo agrupa pelo nome do anúncio.

## Rodar

```bash
cd pka-ninja
npm install
npm run sync-data
npm run dev
```

Abre `http://localhost:5174`.

O `sync-data` copia o capture novo para `data/captures/` e gera `public/data/pka_market.json`. O site baixa só esse arquivo. Os JSON brutos não ficam na pasta pública.

```bash
npm run build-market
npm run compact-market
npm run compact-market -- --write
```

## O que o site mostra

- **Economia** — overview do snapshot, volume, histograma de preço, itens mais listados, maior valor e maior spread.
- **Itens** — catálogo agregado por nome, com busca, categorias, ordenação e paginação.
- **Listagens** — anúncios, busca por item ou player, paginação.
- **Pokémon** — agregado por espécie, quando a descrição permite identificar.
- **Detalhe do item** — min/mediana/máx, histograma e tabela de anúncios.

Preços são em `$` do jogo, por unidade. O total do anúncio é unidade × quantidade.
