# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (3054 строк)

### Секции

- L625-714: 1. Default configuration
- L715-743: 2. State
- L744-813: 3. Helpers
- L814-939: 4. Currency rates — fetch via server-side proxy, manual always wins
- L940-944: 5. Delivery lookup
- L945-949: 6. Route → RUB conversion chains
- L950-960: 7. Main calculation
- L961-2332: 8. Rendering
- L2333-2729: 9. Settings
- L2730-2861: 10. Rate editor sheet
- L2862-2906: 11. Nav + boot
- L2907-3054: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L592-600: `saveDeliveryPrefs()`
- L601-623: `loadDeliveryPrefsFromCloud()`
- L634-634: `applyStoredConfig()`
- L647-647: `getInitData()`
- L648-648: `getTg()`
- L652-660: `tgHaptic()`
- L666-669: `formHasData()`
- L670-675: `updateClosingGuard()`
- L684-697: `saveConfig()`
- L698-703: `saveHistory()`
- L708-713: `saveArchive()`
- L720-735: `defaultForm()`
- L751-751: `groupInt()`
- L752-756: `fmt()`
- L757-757: `num()`
- L764-769: `invalidateCustomsAuto()`
- L775-783: `computeAgeFromDate()`
- L788-791: `applyAgeFromDate()`
- L795-801: `formatNumInput()`
- L802-802: `cleanNumInput()`
- L808-808: `escapeHtml()`
- L809-812: `openExternal()`
- L827-832: `logRateHistory()`
- L834-859: `applyAutoRate()`
- L861-893: `fetchAutoRates()`
- L902-920: `fetchCustomsQuote()`
- L922-930: `setRawValue()`
- L932-938: `clearManualOverride()`
- L943-943: `deliveryPrice()`
- L948-948: `convertToRub()`
- L958-958: `lockedRates()`
- L959-959: `calcDeal()`
- L1001-1010: `rateWidgetData()`
- L1011-1015: `isUpdatedToday()`
- L1020-1024: `rateWidgetStatus()`
- L1025-1040: `rateWidgetHtml()`
- L1044-1052: `bindRateWidget()`
- L1057-1066: `refreshRatesUI()`
- L1071-1080: `fetchCbrReference()`
- L1082-1088: `cbrReferenceHtml()`
- L1090-1122: `openRatesSheet()`
- L1127-1141: `ratesPreviewCardHtml()`
- L1143-1161: `renderTabs()`
- L1165-1179: `renderTopbar()`
- L1181-1187: `renderContent()`
- L1189-1189: `field()`
- L1190-1190: `removeFromArr()`
- L1195-1197: `carriedHint()`
- L1201-1205: `unfilledHint()`
- L1206-1206: `unfilledClass()`
- L1210-1216: `clearFieldHints()`
- L1218-1220: `cityOptions()`
- L1225-1264: `resizeImageToBase64()`
- L1282-1338: `runListingParse()`
- L1340-1636: `renderCalc()`
- L1638-1655: `carDetailLines()`
- L1660-1664: `pushArchive()`
- L1665-1801: `showResult()`
- L1805-1807: `fmtRate()`
- L1816-1934: `buildKpHtml()`
- L1939-1970: `renderKpImageBlob()`
- L1987-2133: `shareResult()`
- L2144-2186: `bindHistorySwipe()`
- L2188-2204: `openClearHistoryConfirm()`
- L2206-2228: `openOtherRoutePicker()`
- L2235-2258: `renderArchiveList()`
- L2260-2331: `renderHistory()`
- L2351-2418: `renderSettingsView()`
- L2424-2436: `themeSettingsCard()`
- L2437-2439: `saveThemeChoice()`
- L2440-2455: `bindThemeSettings()`
- L2461-2477: `openResetConfirm()`
- L2479-2482: `fetchAdminUsers()`
- L2483-2486: `adminAction()`
- L2493-2520: `renderAdminUsersList()`
- L2521-2541: `loadAdminCard()`
- L2553-2561: `fetchDealsApi()`
- L2562-2582: `loadDealsExtraCard()`
- L2583-2599: `openDealsArchiveSheet()`
- L2600-2600: `csvCellIdx()`
- L2601-2601: `idleDaysIdx()`
- L2602-2611: `dealsCsvIdx()`
- L2612-2622: `partiesCsvIdx()`
- L2623-2666: `runDealsExport()`
- L2667-2685: `openWipeDealersConfirm()`
- L2687-2697: `routeSettingsBlock()`
- L2698-2707: `bindRouteSettings()`
- L2709-2718: `deliveryTable()`
- L2719-2728: `bindDeliveryTable()`
- L2733-2733: `openSheet()`
- L2734-2734: `closeSheet()`
- L2739-2757: `openTextFieldSheet()`
- L2803-2821: `openRateHistory()`
- L2823-2860: `openRateEditor()`
- L2886-2886: `toast()`
- L2896-2903: `syncTelegramUI()`
- L2904-2904: `renderAll()`
- L2905-2905: `startApp()`
- L2915-2929: `renderGate()`
- L2931-3048: `bootGate()`


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
