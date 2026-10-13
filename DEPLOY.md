# Deploy do pka.ninja

O código fica em `/opt/pka-ninja`. O site publicado fica em `/var/www/pka.ninja`.

A pasta `/var/www/pka.ninja/data` é outro repositório (`pka-ninja-data`). Um `git pull --ff-only` roda sozinho a cada 5 minutos. O publish não mexe nela.

## Publicar o site

No servidor:

```bash
bash /opt/pka-ninja/scripts/publish.sh
```

O script faz `git pull`, `npm install`, `npm run build` e copia o `dist` para `/var/www/pka.ninja`. As pastas `data` e `data-old` ficam de fora.

## Market

Dentro de `/opt/pka-ninja`, estes comandos leem e gravam direto em `/var/www/pka.ninja/data`:

```bash
cd /opt/pka-ninja
npm run build-site
```

`build-site` lê os `pka_market-*.json` crus do repositório de dados e grava `pka_live.json`, `pka_history.json` e `pka_removed.json`. Não altera os captures. Esses arquivos não entram no repositório de dados, então o pull de 5 minutos continua normal.

O site abre `/data/pka_live.json`. O gráfico de um item baixa `/data/pka_history.json`. O filtro de saídas baixa `/data/pka_removed.json`. Enquanto o `build-site` não rodar no servidor, o site novo não tem o que mostrar.
