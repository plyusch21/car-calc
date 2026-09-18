# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (3064 строк)

### Секции

- L628-717: 1. Default configuration
- L718-746: 2. State
- L747-816: 3. Helpers
- L817-942: 4. Currency rates — fetch via server-side proxy, manual always wins
- L943-947: 5. Delivery lookup
- L948-952: 6. Route → RUB conversion chains
- L953-963: 7. Main calculation
- L964-2342: 8. Rendering
- L2343-2739: 9. Settings
- L2740-2871: 10. Rate editor sheet
- L2872-2916: 11. Nav + boot
- L2917-3064: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L595-603: `saveDeliveryPrefs()`
- L604-626: `loadDeliveryPrefsFromCloud()`
- L637-637: `applyStoredConfig()`
- L650-650: `getInitData()`
- L651-651: `getTg()`
- L655-663: `tgHaptic()`
- L669-672: `formHasData()`
- L673-678: `updateClosingGuard()`
- L687-700: `saveConfig()`
- L701-706: `saveHistory()`
- L711-716: `saveArchive()`
- L723-738: `defaultForm()`
- L754-754: `groupInt()`
- L755-759: `fmt()`
- L760-760: `num()`
- L767-772: `invalidateCustomsAuto()`
- L778-786: `computeAgeFromDate()`
- L791-794: `applyAgeFromDate()`
- L798-804: `formatNumInput()`
- L805-805: `cleanNumInput()`
- L811-811: `escapeHtml()`
- L812-815: `openExternal()`
- L830-835: `logRateHistory()`
- L837-862: `applyAutoRate()`
- L864-896: `fetchAutoRates()`
- L905-923: `fetchCustomsQuote()`
- L925-933: `setRawValue()`
- L935-941: `clearManualOverride()`
- L946-946: `deliveryPrice()`
- L951-951: `convertToRub()`
- L961-961: `lockedRates()`
- L962-962: `calcDeal()`
- L1006-1015: `rateWidgetData()`
- L1016-1020: `isUpdatedToday()`
- L1025-1029: `rateWidgetStatus()`
- L1030-1045: `rateWidgetHtml()`
- L1049-1057: `bindRateWidget()`
- L1062-1071: `refreshRatesUI()`
- L1076-1085: `fetchCbrReference()`
- L1087-1093: `cbrReferenceHtml()`
- L1095-1127: `openRatesSheet()`
- L1132-1146: `ratesPreviewCardHtml()`
- L1148-1166: `renderTabs()`
- L1170-1184: `renderTopbar()`
- L1186-1192: `renderContent()`
- L1194-1194: `field()`
- L1195-1195: `removeFromArr()`
- L1200-1202: `carriedHint()`
- L1206-1210: `unfilledHint()`
- L1211-1211: `unfilledClass()`
- L1215-1221: `clearFieldHints()`
- L1223-1225: `cityOptions()`
- L1230-1269: `resizeImageToBase64()`
- L1287-1343: `runListingParse()`
- L1345-1641: `renderCalc()`
- L1643-1660: `carDetailLines()`
- L1665-1669: `pushArchive()`
- L1670-1806: `showResult()`
- L1810-1812: `fmtRate()`
- L1821-1941: `buildKpHtml()`
- L1946-1980: `renderKpImageBlob()`
- L1997-2143: `shareResult()`
- L2154-2196: `bindHistorySwipe()`
- L2198-2214: `openClearHistoryConfirm()`
- L2216-2238: `openOtherRoutePicker()`
- L2245-2268: `renderArchiveList()`
- L2270-2341: `renderHistory()`
- L2361-2428: `renderSettingsView()`
- L2434-2446: `themeSettingsCard()`
- L2447-2449: `saveThemeChoice()`
- L2450-2465: `bindThemeSettings()`
- L2471-2487: `openResetConfirm()`
- L2489-2492: `fetchAdminUsers()`
- L2493-2496: `adminAction()`
- L2503-2530: `renderAdminUsersList()`
- L2531-2551: `loadAdminCard()`
- L2563-2571: `fetchDealsApi()`
- L2572-2592: `loadDealsExtraCard()`
- L2593-2609: `openDealsArchiveSheet()`
- L2610-2610: `csvCellIdx()`
- L2611-2611: `idleDaysIdx()`
- L2612-2621: `dealsCsvIdx()`
- L2622-2632: `partiesCsvIdx()`
- L2633-2676: `runDealsExport()`
- L2677-2695: `openWipeDealersConfirm()`
- L2697-2707: `routeSettingsBlock()`
- L2708-2717: `bindRouteSettings()`
- L2719-2728: `deliveryTable()`
- L2729-2738: `bindDeliveryTable()`
- L2743-2743: `openSheet()`
- L2744-2744: `closeSheet()`
- L2749-2767: `openTextFieldSheet()`
- L2813-2831: `openRateHistory()`
- L2833-2870: `openRateEditor()`
- L2896-2896: `toast()`
- L2906-2913: `syncTelegramUI()`
- L2914-2914: `renderAll()`
- L2915-2915: `startApp()`
- L2925-2939: `renderGate()`
- L2941-3058: `bootGate()`


## deals.html (2006 строк)

### Секции

- L370-571: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L572-684: 2. Утилиты и состояние
- L685-942: 3. Экран списка
- L943-1155: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L1156-1880: 5. Карточка сделки
- L1881-1945: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1946-2006: 8. Загрузка и гейт

### Функции

- L406-406: `stagesOf()`
- L413-447: `migrateStages()`
- L454-462: `currentStage()`
- L463-463: `stageState()`
- L464-467: `isArchived()`
- L471-478: `lastMovementAt()`
- L479-482: `idleDays()`
- L498-502: `idleNorm()`
- L511-513: `moneyApplies()`
- L518-521: `moneyCalc()`
- L525-533: `moneyParts()`
- L539-546: `moneyDue()`
- L553-570: `fixMoneyAmounts()`
- L592-592: `onlyDigits()`
- L593-596: `formatDivisionCode()`
- L597-604: `formatSnils()`
- L605-621: `formatPhoneRu()`
- L624-628: `bindMask()`
- L632-638: `formatDateDdMmYyyy()`
- L641-644: `formatMoney()`
- L645-648: `tsToDdMmYyyy()`
- L652-659: `parseDdMmYyyy()`
- L660-660: `toast()`
- L661-661: `openSheet()`
- L662-662: `closeSheet()`
- L665-665: `initData()`
- L667-675: `api()`
- L677-683: `pluralDays()`
- L696-737: `bindDealSwipe()`
- L739-756: `openDeleteDealConfirm()`
- L760-798: `dealRowsHtml()`
- L799-813: `bindDealRows()`
- L815-815: `activeDealsOf()`
- L817-826: `renderList()`
- L830-830: `selectTab()`
- L840-860: `renderFlatDeals()`
- L862-870: `renderArchiveList()`
- L872-878: `pluralDealers()`
- L882-916: `renderDealerFolders()`
- L918-938: `renderDealerFolder()`
- L941-941: `auth_isRestricted()`
- L952-979: `openNewDealSheet()`
- L986-1003: `askSamePerson()`
- L1008-1139: `openPartySheet()`
- L1141-1154: `createDeal()`
- L1159-1166: `openDeal()`
- L1172-1232: `moneyCardHtml()`
- L1234-1413: `renderDeal()`
- L1417-1527: `openStageSheet()`
- L1529-1544: `openProblemSheet()`
- L1546-1624: `openDealEditSheet()`
- L1629-1650: `saveDeal()`
- L1658-1669: `loadCalcState()`
- L1687-1690: `endOfDayTs()`
- L1691-1691: `isSameLocalDay()`
- L1692-1692: `recalcKey()`
- L1697-1796: `recalcBookedCalc()`
- L1799-1813: `calcStatusHtml()`
- L1815-1861: `openCalcPicker()`
- L1864-1879: `calcFillsForDeal()`
- L1885-1944: `openParty()`
- L1949-1955: `reloadIndexes()`
- L1963-1966: `gate()`
- L1968-2000: `boot()`
