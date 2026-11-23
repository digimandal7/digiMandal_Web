# Discover frontend integration

All routes use `/api/v1`, require `Authorization: Bearer <token>`, and return `{ success, data, requestId, serverTime }`. Do not hard-code cards, categories, locations, counts, people, images, or events from the designs.

| Screen/action                 | API                                                         | Integration                                                                                                |
| ----------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Open Discover                 | `GET /discover?type=MANDALS&page=1&limit=20`                | Render `hero` when present and bind `items` to post cards. Tabs use `MANDALS`, `ACADEMIES`, and `VENDORS`. |
| Change tab                    | Same endpoint with the selected `type`                      | Replace the list and reset `page=1`.                                                                       |
| Initial search                | `GET /discover/search?q={text}&type=ALL&limit=3`            | Render each non-empty group and use its `total`/`hasNext` for “Show all” buttons.                          |
| Show all results / search tab | `GET /discover/search?q={text}&type={type}&page=1&limit=20` | `type` supports `MANDALS`, `PEOPLE`, `POSTS`, `ACADEMIES`, and `VENDORS`.                                  |
| Open filters                  | `GET /discover/filters`                                     | Render returned `sorts`, `categories`, and `currentLocation`.                                              |
| Location typing               | `GET /discover/locations?q={text}`                          | Debounce input and render `items[].label`; send the selected `city,state` as `location`.                   |
| Current location              | Add `useCurrentLocation=true`                               | Uses the saved Home location, falling back to profile city/state.                                          |
| Apply filters                 | Add `sort=A_Z                                               | Z_A                                                                                                        | NEAREST`, `location=city,state`, and `categories=a,b` | Reset `page=1`; category values must come from `/discover/filters`. |
| Infinite scroll               | Increment `page` while `hasNext=true`                       | Append and de-duplicate by `type + id`. Maximum `limit` is 50.                                             |

`POSTS` items use the same post DTO as Home, including author, Mandal, media variants, event, counts, viewer state, and deep link. Organization results include `type`, location, member count, join state, and deep link. People results expose only public profile display fields.

Academy and Vendor tabs currently use centralized category classification because the existing database has one organization entity (`Mandal`). Categories containing academy/education/school/training/class map to `ACADEMIES`; vendor/business/service/supplier/shop map to `VENDORS`; remaining active organizations map to `MANDALS`.
