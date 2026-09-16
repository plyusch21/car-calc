# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2946 строк)

### Секции

- L420-647: 1. Default configuration
- L648-680: 2. State
- L681-750: 3. Helpers
- L751-907: 4. Currency rates — fetch via server-side proxy, manual always wins
- L908-916: 5. Delivery lookup
- L917-929: 6. Route → RUB conversion chains
- L930-960: 7. Main calculation
- L961-2290: 8. Rendering
- L2291-2636: 9. Settings
- L2637-2767: 10. Rate editor sheet
- L2768-2812: 11. Nav + boot
- L2813-2946: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L387-395: `saveDeliveryPrefs()`
- L396-418: `loadDeliveryPrefsFromCloud()`
- L529-548: `mergeRatesState()`
- L555-566: `mergeRoutesState()`
- L567-572: `applyStoredConfig()`
- L585-585: `getInitData()`
- L586-586: `getTg()`
- L590-598: `tgHaptic()`
- L607-620: `saveConfig()`
- L621-626: `saveHistory()`
- L631-636: `saveArchive()`
- L637-646: `deepMerge()`
- L653-668: `defaultForm()`
- L688-688: `groupInt()`
- L689-693: `fmt()`
- L694-694: `num()`
- L701-706: `invalidateCustomsAuto()`
- L712-720: `computeAgeFromDate()`
- L725-728: `applyAgeFromDate()`
- L732-738: `formatNumInput()`
- L739-739: `cleanNumInput()`
- L745-745: `escapeHtml()`
- L746-749: `openExternal()`
- L764-769: `logRateHistory()`
- L771-796: `applyAutoRate()`
- L798-830: `fetchAutoRates()`
- L839-888: `fetchCustomsQuote()`
- L890-898: `setRawValue()`
- L900-906: `clearManualOverride()`
- L911-915: `deliveryPrice()`
- L920-928: `convertToRub()`
- L933-959: `calcDeal()`
- L1001-1007: `rateWidgetData()`
- L1008-1012: `isUpdatedToday()`
- L1017-1021: `rateWidgetStatus()`
- L1022-1034: `rateWidgetHtml()`
- L1037-1044: `bindRateWidget()`
- L1049-1058: `refreshRatesUI()`
- L1063-1072: `fetchCbrReference()`
- L1074-1080: `cbrReferenceHtml()`
- L1082-1114: `openRatesSheet()`
- L1119-1133: `ratesPreviewCardHtml()`
- L1135-1153: `renderTabs()`
- L1155-1160: `renderContent()`
- L1162-1162: `field()`
- L1163-1163: `removeFromArr()`
- L1168-1170: `carriedHint()`
- L1174-1178: `unfilledHint()`
- L1179-1179: `unfilledClass()`
- L1183-1189: `clearFieldHints()`
- L1191-1193: `cityOptions()`
- L1198-1237: `resizeImageToBase64()`
- L1255-1311: `runListingParse()`
- L1313-1606: `renderCalc()`
- L1608-1624: `carDetailLines()`
- L1629-1633: `pushArchive()`
- L1634-1761: `showResult()`
- L1765-1767: `fmtRate()`
- L1776-1894: `buildKpHtml()`
- L1899-1930: `renderKpImageBlob()`
- L1947-2093: `shareResult()`
- L2104-2146: `bindHistorySwipe()`
- L2148-2164: `openClearHistoryConfirm()`
- L2166-2188: `openOtherRoutePicker()`
- L2195-2217: `renderArchiveList()`
- L2219-2289: `renderHistory()`
- L2306-2366: `renderSettingsView()`
- L2368-2384: `openResetConfirm()`
- L2386-2389: `fetchAdminUsers()`
- L2390-2393: `adminAction()`
- L2400-2427: `renderAdminUsersList()`
- L2428-2448: `loadAdminCard()`
- L2460-2468: `fetchDealsApi()`
- L2469-2489: `loadDealsExtraCard()`
- L2490-2506: `openDealsArchiveSheet()`
- L2507-2507: `csvCellIdx()`
- L2508-2508: `idleDaysIdx()`
- L2509-2518: `dealsCsvIdx()`
- L2519-2529: `partiesCsvIdx()`
- L2530-2573: `runDealsExport()`
- L2574-2592: `openWipeDealersConfirm()`
- L2594-2604: `routeSettingsBlock()`
- L2605-2614: `bindRouteSettings()`
- L2616-2625: `deliveryTable()`
- L2626-2635: `bindDeliveryTable()`
- L2640-2640: `openSheet()`
- L2641-2641: `closeSheet()`
- L2646-2663: `openTextFieldSheet()`
- L2709-2727: `openRateHistory()`
- L2729-2766: `openRateEditor()`
- L2792-2792: `toast()`
- L2802-2809: `syncTelegramUI()`
- L2810-2810: `renderAll()`
- L2811-2811: `startApp()`
- L2821-2835: `renderGate()`
- L2837-2940: `bootGate()`


## deals.html (1325 строк)

### Секции

- L179-252: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L253-360: 2. Утилиты и состояние
- L361-606: 3. Экран списка
- L607-819: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L820-1211: 5. Карточка сделки
- L1212-1276: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1277-1325: 8. Загрузка и гейт

### Функции

- L216-216: `stagesOf()`
- L223-231: `currentStage()`
- L232-232: `stageState()`
- L233-236: `isArchived()`
- L240-247: `lastMovementAt()`
- L248-251: `idleDays()`
- L268-268: `onlyDigits()`
- L269-272: `formatDivisionCode()`
- L273-280: `formatSnils()`
- L281-297: `formatPhoneRu()`
- L300-304: `bindMask()`
- L308-314: `formatDateDdMmYyyy()`
- L317-320: `formatMoney()`
- L321-324: `tsToDdMmYyyy()`
- L328-335: `parseDdMmYyyy()`
- L336-336: `toast()`
- L337-337: `openSheet()`
- L338-338: `closeSheet()`
- L341-341: `initData()`
- L343-351: `api()`
- L353-359: `pluralDays()`
- L372-413: `bindDealSwipe()`
- L415-432: `openDeleteDealConfirm()`
- L436-469: `dealRowsHtml()`
- L470-484: `bindDealRows()`
- L486-486: `activeDealsOf()`
- L488-497: `renderList()`
- L501-501: `selectTab()`
- L511-531: `renderFlatDeals()`
- L533-541: `renderArchiveList()`
- L546-580: `renderDealerFolders()`
- L582-602: `renderDealerFolder()`
- L605-605: `auth_isRestricted()`
- L616-643: `openNewDealSheet()`
- L650-667: `askSamePerson()`
- L672-803: `openPartySheet()`
- L805-818: `createDeal()`
- L823-830: `openDeal()`
- L832-962: `renderDeal()`
- L966-1023: `openStageSheet()`
- L1025-1040: `openProblemSheet()`
- L1042-1113: `openDealEditSheet()`
- L1118-1134: `saveDeal()`
- L1139-1149: `loadCalcHistory()`
- L1151-1191: `openCalcPicker()`
- L1194-1210: `calcFillsForDeal()`
- L1216-1275: `openParty()`
- L1280-1286: `reloadIndexes()`
- L1294-1297: `gate()`
- L1299-1319: `boot()`
