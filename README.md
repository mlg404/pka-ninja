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

O site baixa `pka_live.json` na entrada. O gráfico de um item baixa `pka_history.json`. O filtro de anúncios que saíram baixa `pka_removed.json`.

## Atualizar os arquivos do market

Os captures crus (`pka_market-*.json`) continuam sendo a fonte. O comando abaixo só gera os três arquivos que o site abre e não altera os originais.

Na máquina local, com os JSON em `public/data` ou em `data/captures`:

```bash
cd pka-ninja
npm run build-site
```

No servidor, os captures ficam em `/var/www/pka.ninja/data`. Rode dentro do código publicado:

```bash
cd /opt/pka-ninja
npm run build-site
```

Isso grava, ao lado dos captures:

- `pka_live.json` — quadro atual e valor do market no tempo
- `pka_history.json` — série de preço por item
- `pka_removed.json` — anúncios que saíram nos últimos 7 dias

O deploy do site está em [DEPLOY.md](DEPLOY.md).

## O que o site mostra

- **Economia** — overview do snapshot, volume, histograma de preço, itens mais listados, maior valor e maior spread.
- **Itens** — catálogo agregado por nome, com busca, categorias, ordenação e paginação.
- **Listagens** — anúncios, busca por item ou player, paginação.
- **Pokémon** — agregado por espécie, quando a descrição permite identificar.
- **Detalhe do item** — min/mediana/máx, histograma e tabela de anúncios.

Preços são em `$` do jogo, por unidade. O total do anúncio é unidade × quantidade.
