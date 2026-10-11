# Leveransmejl

Utkast till det avslutande mejlet. Fyll i de tre länkarna och
admin-uppgifterna innan du skickar. Byt ut mottagarnamnet om det inte är Jonas.

> **Skicka inte lösenordet i samma kanal som länken om du kan undvika det** —
> mejla länkarna och skicka lösenordet i ett separat meddelande, eller via
> Signal/SMS.

---

**Ämne:** Kodtest – TalentFlow (mini-ATS)

Hej Jonas,

Här kommer min leverans av kodtestet.

**Live:**
[URL]

**Admin login:**
[email]
[lösenord skickas separat]

**GitHub:**
https://github.com/AllanAkkus/talentflow-ats

**Demo (5 min):**
[Loom-URL]

**Kort om upplägget**

Next.js 16 med App Router, TypeScript och Tailwind i frontend. Supabase i
backend för både auth och databas, hostat på Vercel.

Den viktigaste delen är multi-tenancy. En kund kan aldrig komma åt en annan
kunds jobb, kandidater eller pipeline, och det är inget frontend löser — det
ligger i Row Level Security i Postgres. All appkod kör med den inloggade
användarens egen identitet, så en bugg i en query kan inte läcka data över
tenant-gränsen. Jag har också skrivit ett script (`npm run verify-isolation`)
som loggar in som en kund från varje organisation och faktiskt försöker läsa,
skriva och radera över gränsen — så isoleringen är verifierad, inte antagen.

Datamodellen skiljer på kandidat och ansökan. En kandidat är en person i
kundens talangpool; en ansökan är den personen på ett specifikt jobb, och det är
ansökan som bär rekryteringssteget. Därför kan samma person ligga i flera
processer samtidigt och vara i intervju på ett jobb och avslagen på ett annat.

Kanban-vyn har filter på jobb och sök på kandidatnamn. Att flytta en kandidat
mellan steg gjorde jag först som dropdown och sen drag-and-drop ovanpå — båda
går via samma server action och rullar tillbaka med felmeddelande om databasen
nekar.

Jag har också byggt AI-uppgiften på riktigt: "AI Match Analysis" jämför ett CV
mot ett specifikt jobb och ger matchningspoäng, sammanfattning, styrkor, gap och
förslag på intervjufrågor. Den är medvetet beslutsstöd och inget annat — modellen
får inte föreslå att anställa eller neka, prompten förbjuder den att väga in
skyddade egenskaper som kön, etnicitet eller ålder, och svaret tvingas till ett
JSON-schema som valideras innan det visas. Saknas API-nyckeln säger appen det
rakt ut istället för att fejka ett svar.

**Antaganden**

- En kundanvändare hör till exakt en organisation; en organisation kan ha flera
  användare. Plattformsadmins är globala och kan agera åt vilken kund som helst.
- Ingen publik registrering — admin skapar alla konton. Den första adminen
  skapas med ett script eftersom den inte kan skapas inifrån produkten.
- CV läggs in som text (klistras in). PDF-uppladdning med textutläsning är
  dokumenterat som nästa steg, inte halvbyggt.
- Rekryteringsstegen är fasta i den här versionen: new, screening, interview,
  offer, hired, rejected.
- AI-analysen är rådgivande och ändrar aldrig något i pipelinen.

Fullständiga antaganden ligger i `ASSUMPTIONS.md`, och `PROJECT_LOG.md` är en
ärlig logg över vad som faktiskt gick fel under bygget och hur jag löste det.

Jag har använt AI-verktyg tungt genom hela bygget, framför allt Claude Code —
det var ju också uppmuntrat. Jag har kört, läst igenom och verifierat allt som
genererats: lint, typecheck, tester och build är rena, och
`CODE_REVIEW_NOTES.md` i repot går igenom arkitekturen och avvägningarna om ni
vill gräva i något specifikt.

Säg till om ni vill att jag går igenom någon del djupare, eller om ni vill se
hur jag skulle bygga vidare på det.

Tack för en rolig uppgift!

Hälsningar
Allan
