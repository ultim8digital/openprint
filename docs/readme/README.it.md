# OpenPrint

**Un elenco aperto di studi e laboratori di stampa. Non è richiesta la registrazione né è prevista la presenza di moderatori.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Trova un laboratorio di produzione sulla mappa, verifica le sue capacità e contattalo direttamente. Se il tuo laboratorio non è presente, aggiungi i suoi contatti e i servizi offerti: l’inserzione apparirà immediatamente. Salva il link di gestione privato per modificare o eliminare la tua inserzione in un secondo momento. Il catalogo predefinito non prevede account, conferma via e-mail o una coda di approvazione.

Esegui OpenPrint con Node.js 24 e SQLite locale. Vercel, Supabase, un fornitore di servizi di posta elettronica, l’intelligenza artificiale a pagamento e l’accesso tramite account di terze parti non sono necessari. GitHub ospita il codice sorgente e le versioni; un sito web condiviso che accetta contributi richiede un server API attivo. [GitHub Pagine](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) da solo non è sufficiente per eseguire Node.js API o per salvare le modifiche apportate dai visitatori.

## Funzionalità del catalogo

- Cerca per nome, città e tecnologia. La mappa include le posizioni corrispondenti, indipendentemente dalla paginazione dell’elenco.
- Pubblica senza creare un account. Scegli un punto sulla mappa o inserisci le coordinate; le inserzioni senza coordinate rimangono comunque ricercabili.
- Modifica o elimina una scheda con il relativo link privato. I controlli di versione proteggono da modifiche contrastanti in schede diverse.
- Individua gli studi già presenti prima di pubblicare. I nomi, le città e gli indirizzi duplicati vengono automaticamente rifiutati.
- Importa un catalogo specificando la fonte. Gli operatori non possono sovrascrivere le inserzioni pubblicate autonomamente.
- Visualizza OpenStreetMap riquadri senza una API chiave. I riquadri vengono caricati quando viene visualizzata una mappa, inclusa la pagina iniziale predefinita.
- Seleziona la lingua dell’interfaccia dal menu delle lingue. Consulta il file README completo nella tua lingua tramite l’indice delle lingue riportato sopra.

La pubblicazione non verifica la proprietà dell’attività né la qualità del servizio. Verificare con lo studio le attrezzature, le capacità e le condizioni. Chiunque disponga del link di gestione privato può controllare tale inserzione. Mantenere il link privato; non è previsto il recupero tramite e-mail. Consultare la [guida all’autopubblicazione](../../docs/OPEN_CATALOG.md).

## Avvia la tua istanza

Installa Node.js 24, clona questo repository ed esegui:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. L’impostazione predefinita `APP_MODE=catalog` non richiede configurazioni da parte dell’amministratore o dell’utente. Configurare `APP_URL`, HTTPS e i backup utilizzando la [guida all’hosting autonomo](../../docs/SELF_HOSTING.md). Docker È disponibile anche Compose: `docker compose up --build -d`.

La configurazione supportata prevede un singolo processo applicativo con SQLite su un disco locale. La pubblicazione automatica e le quote di richieste limitano gli abusi senza la necessità di una coda di moderazione. Un indirizzo IP di ufficio condiviso può condividere una quota di pubblicazione. Consultare [limiti e comportamento del collegamento di gestione](../../docs/OPEN_CATALOG.md) prima di aprire un’istanza pubblica.

Utilizza l’[interfaccia a riga di comando per l’importazione del catalogo](../../docs/CATALOG_IMPORT.md) per un set di dati esistente, dopo averne verificato i diritti. I set di dati di istanza, i file caricati e i backup non sono inclusi nel repository o nelle immagini del container.

## Modalità Neofab e funzionalità della community, opzionali

Impostare esplicitamente `APP_MODE=community` per abilitare i progetti privati, le quotazioni dei fornitori, la libreria di modelli e Neofab Studio. Questi flussi di lavoro utilizzano account e autorizzazioni proprie. Il passaggio tra le modalità preserva i dati salvati. La modalità catalogo non rende accessibile la cronologia privata della community tramite il suo API né riprende i lavori in coda CAD.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) supporta documenti di progetto di produzione con controllo delle versioni, distinte base e dichiarazioni CAD con esportazioni in STEP/STL. CAD e l’IA sono opzionali. Le proposte generate dall’IA richiedono una revisione e una fase di approvazione separata; non pubblicano automaticamente gli ordini né generano la geometria. CAM, il codice G e la convalida fisica della produzione non sono implementati.

## Diritti sui dati e protezione della privacy

La licenza software MIT non concede diritti sui dati aziendali importati. La semplice indicazione della fonte non autorizza la copia di dati da Google Maps, 2GIS, Yandex Maps o altre fonti. Verificare le autorizzazioni per l’archiviazione, la pubblicazione e la ridistribuzione prima di utilizzare un set di dati. Consultare [provenienza e limiti di revisione dei dati](../../docs/DATA_PROVENANCE.md).

Le informazioni di contatto pubblicate autonomamente sono accessibili a tutti; le chiavi di gestione sono private. Conserva i database e i backup al di fuori delle directory accessibili pubblicamente e fornisci un contatto per richieste di correzioni e rimozioni. Consulta le sezioni relative a [privacy](../../PRIVACY.md) e [sicurezza](../../SECURITY.md) prima dell’implementazione.

## Sviluppo e traduzione

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Le azioni verificano i tipi, API e i flussi di lavoro del browser, nonché i CAD container predefiniti e nativi. I test utilizzano dati fittizi. Le prove esatte, la copertura e i limiti rimanenti sono registrati in [validazione](../../docs/VALIDATION.md) e [ambito del prodotto](../../docs/PRODUCT.md).

Il file README in inglese è il riferimento per le versioni tradotte complete. L’[indice delle lingue](../../docs/i18n/README.md) documenta i limiti relativi alla manutenzione e alla revisione delle traduzioni. La localizzazione dell’interfaccia non traduce gli elenchi creati dagli utenti, i contenuti dei progetti o ogni elemento tecnico diagnostico esterno.

## Licenze e contributi

Il codice sorgente originale, l’interfaccia utente, le SVG illustrazioni, la documentazione e il generatore parametrico sono concessi in licenza [MIT](../../LICENSE). Le dipendenze mantengono le proprie licenze e avvisi. I modelli degli utenti sono soggetti a una licenza separata, scelta dai rispettivi autori. Un profilo demo fittizio e un breve testo, nonché tre progetti demo generati, sono dedicati sotto CC0; il generatore rimane MIT. Consultare gli [avvisi di terze parti](../../THIRD_PARTY_NOTICES.md).

Questa implementazione indipendente sviluppa il concetto di [3d-online.app](https://3d-online.app). Non sono inclusi gli account originali, le credenziali, la cronologia del repository Git privato e i file degli utenti. Il compilatore MIT Neofab CAD adattato mantiene la [licenza originale e l’indicazione di provenienza](../../cad-worker/NOTICE.md).

I contributi possono includere codice, correzioni di traduzione, miglioramenti dell’usabilità, modelli parametrici open source, verifiche dell’installazione e feedback da parte di laboratori reali. Inizia con [CONTRIBUTING.md](../../CONTRIBUTING.md).
