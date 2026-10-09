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
npm run build-market
npm run compact-market -- --write
```

`build-market` junta os captures em `pka_market.json` (e nos arquivos `.gz` e `.br`). Esse arquivo não entra no repositório de dados, então o pull de 5 minutos continua normal.

Antes do primeiro publish do site novo, rode o `build-market`. O site só abre `/data/pka_market.json`. Enquanto o publish não rodar, o site que está no ar continua o atual.

`compact-market -- --write` reescreve os JSON de capture que o repositório de dados versiona. Se o pull automático receber a mesma alteração nesses arquivos, o `git pull --ff-only` pode falhar.
