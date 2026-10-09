# senkonmuhendislik.com home page: firm voice

Date: 2026-10-09
Owner: Fırat Şentürk (Senkon Mühendislik)
Status: approved in chat on 2026-10-09. Supersedes the voice and section order of
`2026-10-09-home-page-design.md`; the look (direction C, light only, skyline band, Esenboğa
figure) is unchanged.

## 1. Goal

The page currently speaks as one engineer ("görev aldığım projeler", a CV-style Hakkında
block with name, degrees and employers). It should speak as the firm, Senkon Mühendislik, and
sell what the firm can do today rather than what its people did at earlier employers. The
founder's name appears nowhere on the page except in the e-mail address. A founder or team
page is deferred; no placeholder link for now.

## 2. Decisions

| Topic | Decision |
|---|---|
| Voice | First person plural, firm as subject ("tasarlıyoruz", "hesaplıyoruz"). No personal names. |
| Lead message | Hero stays general: taşıyıcı sistem tasarımı **ve** deprem performans değerlendirmesi (option B). The specialist work gets its own section right after the skyline band, before Hizmetler. |
| Specialist section | "Deprem performans değerlendirmesi": existing concrete and steel buildings assessed to TBDY 2018 and international codes; nonlinear models, pushover and nonlinear time-history analysis with real ground-motion records (for example the 6 February 2023 Kahramanmaraş records) scaled to the site; outcome is the building's performance level, where damage concentrates, and whether and how to strengthen. Text only in this round; a figure may follow. |
| Not added | No code chip row, no deliverables list, no "how we work" steps, no analysis-type list (Fırat, 2026-10-09). |
| Projects | Kept but demoted below the tools, retitled "Deneyim", firm-voice note: "Ekibimizin GVN Tasarım ve Mühendislik ile Yapı Akademisi Mühendislik bünyesinde görev aldığı projelerden." Esenboğa featured figure and the six cards stay; the Esenboğa text loses "görev aldığım". Tentative: may be removed later. |
| Hakkında | Becomes "Senkon Mühendislik": one paragraph about the practice (İstanbul, what it designs, codes, how it works with clients). Education and employment list removed. Software chips stay. |
| Tools | Model section unchanged in function, wording firm-voice. StructKit is not a main instrument (Fırat, 2026-10-09): its section and hero button are removed; it survives as one line at the end of the Model section and a footer link. Hero's second button points to #performans. |
| Contact, footer | Unchanged. Personal e-mail stays. |
| Nav | Performans · Hizmetler · Model · Deneyim · Hakkında · İletişim. |
| Metadata | `<title>`, description and og tags updated to the new headline. |
| Facts to confirm | Which international codes to name (candidates: ASCE 41, Eurocode 8). Until confirmed the copy says "uluslararası yönetmelikler" without naming any. Analysis software is not named. |

## 3. Page order

1. Header and nav.
2. Hero: eyebrow "Senkon Mühendislik · İstanbul"; h1 "Taşıyıcı sistem tasarımı ve deprem
   performans değerlendirmesi"; lead in firm voice; buttons unchanged.
3. Skyline band, unchanged.
4. **Performans** (new, `#performans`).
5. Hizmetler, five items; item 03 points to the section above.
6. Model, ending with the one-line StructKit pointer.
8. **Deneyim** (`#deneyim`, was `#projeler`).
9. Hakkında: Senkon Mühendislik.
10. İletişim, footer.

## 4. Out of scope

Founder page, project photos, og image, StructKit restyle. Cache-busting `?v=` values bump if
`site.css` changes.
