# Demo script — TalentFlow (5 minuter)

Manus för Loom-inspelningen. Talpunkterna är skrivna att sägas naturligt, inte
läsas rakt upp. Tiderna är riktmärken — ligger du 10 sekunder efter är det lugnt,
men klipp hellre i avsnitt 7 än i 4 och 5.

**Innan du spelar in**

- Kör `npm run seed` så Kanban-tavlan har data.
- Ha tre flikar redo: (1) inloggad som admin, (2) inloggningssidan i ett
  inkognitofönster för kundinloggningen, (3) GitHub-repot.
- Logga ut i fliken du börjar i, så första klicket blir en riktig inloggning.
- Zooma till ca 110 % i browsern — texten i appen är kompakt.
- Stäng notiser.

---

## 0:00–0:30 — Intro

**Visa:** inloggningssidan.

> "Hej, jag heter Allan. Det här är TalentFlow, ett mini-ATS som jag byggt på
> kodtestet. Problemet jag löst är det enklaste tänkbara för en rekryterare: få
> in jobben, få in kandidaterna, och se var i processen varje kandidat ligger —
> utan att behöva ett Excel-ark.
>
> Stacken är Next.js 16 med App Router, TypeScript och Tailwind i frontend, och
> Supabase i backend för både autentisering och databas. Hostat på Vercel.
>
> Det jag framför allt vill visa är tre saker: att kundresan funkar hela vägen,
> att en kund aldrig kan se en annan kunds data, och en AI-funktion som ger
> beslutsstöd — inte beslut."

---

## 0:30–1:15 — Admin: organisationer och användare

**Gör:** logga in som admin. Peka på rollbrickan "Platform admin" i sidomenyn.

> "Jag loggar in som plattformsadmin. Det finns ingen publik registrering i
> TalentFlow — alla konton skapas av en admin, och den allra första adminen
> skapas med ett script eftersom den inte kan skapas inifrån produkten."

**Gör:** klicka **Organizations**.

> "Här är alla kunder. Varje organisation är en helt egen tenant — egna jobb,
> egna kandidater, egen pipeline. Northstar Consulting är demokunden. Lumen
> Health finns för att jag ska kunna visa att isoleringen faktiskt håller."

**Gör:** klicka **Users**, öppna **New user**, visa formuläret (fyll i men skicka
inte nödvändigtvis).

> "Som admin kan jag skapa både kundanvändare och andra admins. En kund måste
> höra till en organisation — jag kan antingen välja en befintlig eller skapa en
> ny direkt här. En admin är global och hör inte till någon organisation alls;
> det är en check-constraint i databasen, inte bara en regel i koden.
>
> Själva kontoskapandet går via en server-route, `/api/admin/users`, eftersom
> det kräver Supabase service-role-nyckeln. Den nyckeln går förbi all
> radsäkerhet, så den får aldrig hamna i browsern."

---

## 1:15–2:00 — Admin agerar som kund: jobb

**Gör:** peka på **Viewing organization**-väljaren i toppen, byt till
Northstar Consulting AB.

> "Det här är nyckeln till admin-upplevelsen. Jag väljer vilken organisation jag
> jobbar som, och sen kan jag göra allt en kund kan göra åt dem. Vilken
> organisation som är aktiv syns alltid här uppe — annars är det alldeles för
> lätt att råka lägga in en kandidat hos fel kund."

**Gör:** klicka **Jobs**, öppna **Backend Developer**.

> "Tre öppna roller. På jobbvyn ser jag kandidaterna som ligger på just det
> jobbet, vilket steg de är i, och en sammanfattning av pipelinen."

**Gör:** klicka **New job**, skriv en titel, visa statusväljaren, skapa.

> "Nytt jobb går på några sekunder. Status är draft, open eller closed.
> Beskrivningen är inte bara text för läsarens skull — det är den som
> AI-analysen jämför CV:t mot sen."

---

## 2:00–2:45 — Kandidater, LinkedIn och applikationer

**Gör:** klicka **Candidates**, öppna **Anna Andersson**.

> "Kandidaterna är organisationens talangpool. Namn, mejl, telefon, ort,
> LinkedIn-länk — som är klickbar här — och CV:t som text."

**Gör:** klicka LinkedIn-länken så det syns att den öppnas i ny flik, gå tillbaka.

> "LinkedIn-URL:en valideras som en riktig http- eller https-adress innan den
> sparas, så det går inte att få in något konstigt i en länk."

**Gör:** peka på **Jobs & pipeline**-kortet, öppna **Assign to job**.

> "Och här är den viktigaste modelleringen i hela projektet: en kandidat är inte
> samma sak som en ansökan. Kandidaten är personen. När jag kopplar henne till
> ett jobb skapas en *application* — och det är den som bär rekryteringssteget.
>
> Det betyder att samma person kan vara med i flera processer samtidigt.
> Johan Nilsson här ligger till exempel på både Backend och Frontend, och kan
> vara i intervju på ena och avslagen på andra. Det hade inte gått om jag bara
> lagt ett `job_id` på kandidaten."

---

## 2:45–3:40 — Kanban: filter, sök och flytta steg

**Gör:** klicka **Pipeline**.

> "Det här är vyn en rekryterare faktiskt bor i. Alla ansökningar i
> organisationen, i kolumner per steg: New, Screening, Interview, Offer, Hired.
> Rejected ligger bakom en kryssruta så att tavlan håller sig läsbar."

**Gör:** välj **Backend Developer** i jobbfiltret.

> "Filtrera på jobb —"

**Gör:** skriv "berg" i sökfältet, töm det igen.

> "— och sök på kandidatnamn. Det är ofiltrerat direkt i browsern över
> organisationens egna rader, så det känns omedelbart. Men det är bara UX: datan
> är redan begränsad till rätt tenant av databasen innan den ens når browsern."

**Gör:** byt steg på ett kort med **dropdownen** på kortet.

> "Att flytta en kandidat kan jag göra på två sätt. Dropdownen byggde jag först,
> och det är den pålitliga vägen — den funkar med tangentbord och på mobil."

**Gör:** dra ett kort från Screening till Interview med handtaget.

> "Och sen drag-and-drop ovanpå. Båda går via exakt samma server action, båda är
> optimistiska, och om databasen skulle neka ändringen hoppar kortet tillbaka och
> jag får ett felmeddelande. Jag ville inte att drag-and-drop skulle vara det som
> gör produkten opålitlig."

---

## 3:40–4:25 — AI Match Analysis

**Gör:** gå till **Candidates → Anna Andersson**, expandera **AI match** på
Backend Developer-ansökan, klicka **Run AI Match Analysis**.

> "Sen den extra AI-uppgiften. Det här är AI Match Analysis: den jämför en
> kandidats CV mot ett *specifikt* jobb."

**Gör:** vänta in resultatet, peka på score, summary, strengths, gaps, frågorna.

> "Den ger en matchningspoäng, en sammanfattning, styrkor, gap, och förslag på
> intervjufrågor som skulle täcka just de gapen.
>
> Tre saker jag medvetet gjort:
>
> Det ena — browsern skickar bara ett ansöknings-id. Jobbeskrivningen, CV-texten,
> prompten och API-nyckeln ligger kvar på servern.
>
> Det andra — modellen är instruerad att bara väga jobbrelevant underlag.
> Prompten förbjuder den uttryckligen att gissa eller poängsätta kön, etnicitet,
> ålder, religion, hälsa eller liknande, och svarsformatet har inget fält som
> ens kunde bära en sån uppgift.
>
> Det tredje — den får inte fatta beslut. Den föreslår aldrig att anställa eller
> neka, och det står här under att slutgiltiga beslut ska fattas av en människa.
> Svaret tvingas till ett JSON-schema och valideras med Zod innan det visas, så
> ett konstigt svar blir ett felmeddelande istället för trasig UI."

**Om `OPENAI_API_KEY` inte är satt i miljön du spelar in i:**

> "Här är nyckeln inte satt, och då säger appen det rakt ut istället för att
> fejka ett svar — allt annat i ATS:et funkar som vanligt."

---

## 4:25–5:00 — Arkitektur, säkerhet och avvägningar

**Gör:** logga in som kund i inkognitofliken (`anna@northstar.example.com`).

> "Sista biten, och det jag lagt mest omsorg på. Här loggar jag in som en
> vanlig kundanvändare istället. Ingen organisationsväljare, ingen adminmeny —
> och viktigare: hon får inte ut Lumen Healths data ens om hon försöker."

**Gör:** peka på sidomenyn, och på README/repot i tredje fliken.

> "Isoleringen ligger i Row Level Security i Postgres, inte i frontend. Varje
> tabell har policys som säger att du bara ser rader där `organization_id`
> stämmer med din egen profil — och admins passerar alltid. All appkod kör med
> den inloggade användarens egen identitet, så en bugg i en query kan inte läcka
> en annan kunds rader.
>
> Och jag har inte bara antagit att det funkar. Det finns ett script,
> `verify-isolation`, som loggar in som en kund från varje organisation med
> samma nyckel som browsern använder och försöker läsa, skriva, uppdatera och
> radera över tenant-gränsen — inklusive att skicka in en annan kunds
> `organization_id`. Alla försök nekas, och scriptet failar bygget om något
> skulle gå igenom.
>
> Det jag skulle göra härnäst med en vecka till: audit-logg på alla
> stegändringar, CV-uppladdning som PDF med textutläsning, och mejlinbjudningar
> så att admins slutar hantera lösenord.
>
> Allt ligger i repot — README, antaganden och en projektlogg med det som
> faktiskt gick fel under bygget. Tack!"

---

## Checklista efter inspelning

- [ ] Syns inga riktiga lösenord i bild (admin-lösenordet skickas separat)?
- [ ] Syns inga `.env`-värden, service-role-nycklar eller API-nycklar?
- [ ] Är videon under 5:30?
- [ ] Är ljudet jämnt hela vägen?
