# Timesheet Tool — Requirementsheet

## 1. Overzicht

Een lokale webapplicatie (single-user) voor het bijhouden van gewerkte uren per **Client > Project > Subproject**. Per tijdsinvoer worden zowel **werkelijke uren** als **gefactureerde uren** vastgelegd. De tool draait volledig lokaal met een kleine backend en database zodat data niet verloren kan gaan.

---

## 2. Architectuur

| Component       | Keuze                                                        |
| --------------- | ------------------------------------------------------------ |
| **Frontend**    | React + Vite (TypeScript), Tailwind CSS                      |
| **Backend**     | Node.js + Express                                            |
| **Database**    | SQLite (lokaal bestand, geen externe server nodig)           |
| **Taal UI**     | Nederlands                                                   |
| **Gebruikers**  | 1 (geen authenticatie nodig)                                 |

---

## 3. Datamodel

### 3.1 Hiërarchie

```
Client (bijv. "Roularta Media Group")
  └── Project (bijv. "Groeiplan 2026")
        └── Subproject (bijv. "Frontend development")
```

### 3.2 Entiteiten

**Client**
| Veld   | Type    | Verplicht |
| ------ | ------- | --------- |
| id     | integer | PK, auto  |
| naam   | string  | ja        |
| actief | boolean | ja (default: true) |

**Project**
| Veld      | Type    | Verplicht |
| --------- | ------- | --------- |
| id        | integer | PK, auto  |
| clientId  | integer | FK → Client |
| naam      | string  | ja        |
| actief    | boolean | ja (default: true) |

**Subproject**
| Veld       | Type    | Verplicht |
| ---------- | ------- | --------- |
| id         | integer | PK, auto  |
| projectId  | integer | FK → Project |
| naam       | string  | ja        |
| actief     | boolean | ja (default: true) |

**Tijdregistratie (TimeEntry)**
| Veld              | Type    | Verplicht |
| ----------------- | ------- | --------- |
| id                | integer | PK, auto  |
| subprojectId      | integer | FK → Subproject |
| datum             | date    | ja        |
| werkelijkeUren    | decimal | ja (default: 0) |
| gefactureerdeUren | decimal | ja (default: 0) |

### 3.3 Berekeningen

- **Subproject-totaal** = som van `gefactureerdeUren` van alle entries voor die subproject in de maand
- **Project-totaal** = som van alle subproject-totalen binnen dat project
- **Client-totaal** = som van alle project-totalen binnen die client
- Alle hogere niveaus rekenen met **gefactureerde uren** (niet werkelijke)

---

## 4. Functionaliteit

### 4.1 Maandweergave (hoofdscherm)

**Layout: rij-gebaseerd grid**

```
                        | 1 ma | 2 di | 3 wo | ... | 31 wo | TOTAAL |
Client A                |      |      |      |     |       |  XX.X  |
  └ Project 1           |      |      |      |     |       |  XX.X  |
      └ Subproject X    | 2.5  | 3.0  |      |     |       |  XX.X  |
         werkelijk:     | 2.5  | 3.0  |      |     |       |  XX.X  |
         gefactureerd:  | 2.0  | 3.0  |      |     |       |  XX.X  |
      └ Subproject Y    | 1.0  |      | 4.5  |     |       |  XX.X  |
  └ Project 2           |      |      |      |     |       |  XX.X  |
Client B                |      |      |      |     |       |  XX.X  |
```

- Rijen zijn inklapbaar per niveau (client → projecten → subprojecten)
- Kolommen: elke dag van de maand + maandtotaal rechts
- Weekend-kolommen visueel onderscheiden (lichter/grijzer)
- Dagkolommen tonen de dagnaam (ma, di, wo, do, vr, za, zo) + dagnummer
- Uren invoeren in **decimaal formaat** (bijv. `7.5`)
- Klikken op een cel → direct inline bewerken
- Per subproject-rij: twee sub-rijen voor **werkelijke** en **gefactureerde** uren
- Lege cellen blijven leeg (geen `0.00` tonen)

### 4.2 Beheer van Clients / Projecten / Subprojecten

- **Toevoegen**: eenvoudige actie vanuit het hoofdscherm (bijv. "+" knop per niveau)
- **Bewerken**: naam aanpassen via inline edit of modal
- **Deactiveren**: soft-delete (markeer als inactief, toon niet meer in invoer maar behoud data)
- Hiërarchie afdwingen: subproject vereist project, project vereist client

### 4.3 Maandnavigatie

- Huidige maand standaard geselecteerd
- Maand/jaar selector om naar andere maanden te navigeren

### 4.4 Printbare rapportage per client per maand

**Doel**: Een overzicht genereren en printen dat per client de totale gefactureerde uren toont, uitgesplitst per project en (optioneel) per subproject.

**Voorbeeld output**:

```
Rapport: Maart 2026 — Roularta Media Group
─────────────────────────────────────────
Groeiplan 2026 dedicated team          40.0 uur
  ├ Frontend development               24.0 uur
  └ Backend API                        16.0 uur

Totaal Roularta Media Group:           40.0 uur
```

- Selecteer client + maand → bekijk rapport
- Print-knop → opent browser print dialog (CSS `@media print` optimalisatie)
- Nette layout zonder UI-elementen (geen knoppen, navigatie etc. op print)

---

## 5. UI / UX Richtlijnen

| Aspect            | Richtlijn                                                       |
| ----------------- | --------------------------------------------------------------- |
| **Taal**          | Nederlands (alle labels, knoppen, maanden, dagen)               |
| **Kleurenschema** | Licht thema (donker thema als nice-to-have)                     |
| **Typografie**    | Duidelijk leesbaar, compact genoeg voor 31 kolommen             |
| **Invoer**        | Inline editing in cellen, tab-navigatie tussen cellen            |
| **Feedback**      | Auto-save bij verlaten cel (geen aparte "Opslaan" knop)         |
| **Responsiviteit**| Desktop-first, horizontaal scrollbaar voor veel kolommen         |
| **Weekenden**     | Visueel onderscheiden maar wel bewerkbaar                       |

---

## 6. API Endpoints (REST)

### Clients
| Methode | Pad                  | Beschrijving              |
| ------- | -------------------- | ------------------------- |
| GET     | `/api/clients`       | Alle actieve clients      |
| POST    | `/api/clients`       | Nieuwe client aanmaken    |
| PUT     | `/api/clients/:id`   | Client bewerken           |
| DELETE  | `/api/clients/:id`   | Client deactiveren        |

### Projecten
| Methode | Pad                              | Beschrijving              |
| ------- | -------------------------------- | ------------------------- |
| GET     | `/api/clients/:id/projects`      | Projecten van een client  |
| POST    | `/api/projects`                  | Nieuw project aanmaken    |
| PUT     | `/api/projects/:id`              | Project bewerken          |
| DELETE  | `/api/projects/:id`              | Project deactiveren       |

### Subprojecten
| Methode | Pad                                  | Beschrijving                  |
| ------- | ------------------------------------ | ----------------------------- |
| GET     | `/api/projects/:id/subprojects`      | Subprojecten van een project  |
| POST    | `/api/subprojects`                   | Nieuw subproject aanmaken     |
| PUT     | `/api/subprojects/:id`               | Subproject bewerken           |
| DELETE  | `/api/subprojects/:id`               | Subproject deactiveren        |

### Tijdregistratie
| Methode | Pad                                          | Beschrijving                       |
| ------- | -------------------------------------------- | ---------------------------------- |
| GET     | `/api/time-entries?maand=2026-03`            | Alle entries voor een maand        |
| PUT     | `/api/time-entries`                          | Entry aanmaken of bijwerken (upsert) |

### Rapporten
| Methode | Pad                                                  | Beschrijving                          |
| ------- | ---------------------------------------------------- | ------------------------------------- |
| GET     | `/api/reports/client/:id?maand=2026-03`              | Maandrapport per client               |

---

## 7. Niet-functionele eisen

| Eis                  | Detail                                                     |
| -------------------- | ---------------------------------------------------------- |
| **Prestatie**        | Pagina laadt < 1s, cel-save < 200ms                       |
| **Dataveiligheid**   | SQLite bestand lokaal, regelmatige backup aanmoedigen      |
| **Draait op**        | localhost (geen deployment nodig)                          |
| **Opstartgemak**     | Eén commando om backend + frontend te starten              |

---

## 8. Buiten scope (MVP)

- [ ] Export naar CSV / PDF / Excel
- [ ] Multi-user / authenticatie
- [ ] Week-navigatie (alleen maandweergave)
- [ ] Donker thema (nice-to-have, lage prioriteit)
- [ ] Drag & drop van uren
- [ ] Timer / stopwatch functionaliteit
- [ ] Factuurgeneratie

---

## 9. Technische stack samenvatting

```
Frontend:  React 19 + TypeScript + Vite + Tailwind CSS
Backend:   Node.js + Express + better-sqlite3
Database:  SQLite (single file)
Taal:      Nederlands
```
