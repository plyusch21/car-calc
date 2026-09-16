# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2978 строк)

### Секции

- L420-662: 1. Default configuration
- L663-695: 2. State
- L696-765: 3. Helpers
- L766-922: 4. Currency rates — fetch via server-side proxy, manual always wins
- L923-931: 5. Delivery lookup
- L932-944: 6. Route → RUB conversion chains
- L945-975: 7. Main calculation
- L976-2312: 8. Rendering
- L2313-2658: 9. Settings
- L2659-2790: 10. Rate editor sheet
- L2791-2835: 11. Nav + boot
- L2836-2978: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L387-395: `saveDeliveryPrefs()`
- L396-418: `loadDeliveryPrefsFromCloud()`
- L529-548: `mergeRatesState()`
- L555-566: `mergeRoutesState()`
- L567-572: `applyStoredConfig()`
- L585-585: `getInitData()`
- L586-586: `getTg()`
- L590-598: `tgHaptic()`
- L604-607: `formHasData()`
- L608-613: `updateClosingGuard()`
- L622-635: `saveConfig()`
- L636-641: `saveHistory()`
- L646-651: `saveArchive()`
- L652-661: `deepMerge()`
- L668-683: `defaultForm()`
- L703-703: `groupInt()`
- L704-708: `fmt()`
- L709-709: `num()`
- L716-721: `invalidateCustomsAuto()`
- L727-735: `computeAgeFromDate()`
- L740-743: `applyAgeFromDate()`
- L747-753: `formatNumInput()`
- L754-754: `cleanNumInput()`
- L760-760: `escapeHtml()`
- L761-764: `openExternal()`
- L779-784: `logRateHistory()`
- L786-811: `applyAutoRate()`
- L813-845: `fetchAutoRates()`
- L854-903: `fetchCustomsQuote()`
- L905-913: `setRawValue()`
- L915-921: `clearManualOverride()`
- L926-930: `deliveryPrice()`
- L935-943: `convertToRub()`
- L948-974: `calcDeal()`
- L1016-1022: `rateWidgetData()`
- L1023-1027: `isUpdatedToday()`
- L1032-1036: `rateWidgetStatus()`
- L1037-1049: `rateWidgetHtml()`
- L1052-1059: `bindRateWidget()`
- L1064-1073: `refreshRatesUI()`
- L1078-1087: `fetchCbrReference()`
- L1089-1095: `cbrReferenceHtml()`
- L1097-1129: `openRatesSheet()`
- L1134-1148: `ratesPreviewCardHtml()`
- L1150-1168: `renderTabs()`
- L1170-1175: `renderContent()`
- L1177-1177: `field()`
- L1178-1178: `removeFromArr()`
- L1183-1185: `carriedHint()`
- L1189-1193: `unfilledHint()`
- L1194-1194: `unfilledClass()`
- L1198-1204: `clearFieldHints()`
- L1206-1208: `cityOptions()`
- L1213-1252: `resizeImageToBase64()`
- L1270-1326: `runListingParse()`
- L1328-1624: `renderCalc()`
- L1626-1642: `carDetailLines()`
- L1647-1651: `pushArchive()`
- L1652-1783: `showResult()`
- L1787-1789: `fmtRate()`
- L1798-1916: `buildKpHtml()`
- L1921-1952: `renderKpImageBlob()`
- L1969-2115: `shareResult()`
- L2126-2168: `bindHistorySwipe()`
- L2170-2186: `openClearHistoryConfirm()`
- L2188-2210: `openOtherRoutePicker()`
- L2217-2239: `renderArchiveList()`
- L2241-2311: `renderHistory()`
- L2328-2388: `renderSettingsView()`
- L2390-2406: `openResetConfirm()`
- L2408-2411: `fetchAdminUsers()`
- L2412-2415: `adminAction()`
- L2422-2449: `renderAdminUsersList()`
- L2450-2470: `loadAdminCard()`
- L2482-2490: `fetchDealsApi()`
- L2491-2511: `loadDealsExtraCard()`
- L2512-2528: `openDealsArchiveSheet()`
- L2529-2529: `csvCellIdx()`
- L2530-2530: `idleDaysIdx()`
- L2531-2540: `dealsCsvIdx()`
- L2541-2551: `partiesCsvIdx()`
- L2552-2595: `runDealsExport()`
- L2596-2614: `openWipeDealersConfirm()`
- L2616-2626: `routeSettingsBlock()`
- L2627-2636: `bindRouteSettings()`
- L2638-2647: `deliveryTable()`
- L2648-2657: `bindDeliveryTable()`
- L2662-2662: `openSheet()`
- L2663-2663: `closeSheet()`
- L2668-2686: `openTextFieldSheet()`
- L2732-2750: `openRateHistory()`
- L2752-2789: `openRateEditor()`
- L2815-2815: `toast()`
- L2825-2832: `syncTelegramUI()`
- L2833-2833: `renderAll()`
- L2834-2834: `startApp()`
- L2844-2858: `renderGate()`
- L2860-2972: `bootGate()`


## deals.html (1494 строк)

### Секции

- L184-322: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L323-430: 2. Утилиты и состояние
- L431-683: 3. Экран списка
- L684-896: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L897-1371: 5. Карточка сделки
- L1372-1436: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1437-1494: 8. Загрузка и гейт

### Функции

- L221-221: `stagesOf()`
- L228-236: `currentStage()`
- L237-237: `stageState()`
- L238-241: `isArchived()`
- L245-252: `lastMovementAt()`
- L253-256: `idleDays()`
- L265-267: `moneyApplies()`
- L272-275: `moneyCalc()`
- L279-287: `moneyParts()`
- L292-299: `moneyDue()`
- L304-321: `fixMoneyAmounts()`
- L338-338: `onlyDigits()`
- L339-342: `formatDivisionCode()`
- L343-350: `formatSnils()`
- L351-367: `formatPhoneRu()`
- L370-374: `bindMask()`
- L378-384: `formatDateDdMmYyyy()`
- L387-390: `formatMoney()`
- L391-394: `tsToDdMmYyyy()`
- L398-405: `parseDdMmYyyy()`
- L406-406: `toast()`
- L407-407: `openSheet()`
- L408-408: `closeSheet()`
- L411-411: `initData()`
- L413-421: `api()`
- L423-429: `pluralDays()`
- L442-483: `bindDealSwipe()`
- L485-502: `openDeleteDealConfirm()`
- L506-539: `dealRowsHtml()`
- L540-554: `bindDealRows()`
- L556-556: `activeDealsOf()`
- L558-567: `renderList()`
- L571-571: `selectTab()`
- L581-601: `renderFlatDeals()`
- L603-611: `renderArchiveList()`
- L613-619: `pluralDealers()`
- L623-657: `renderDealerFolders()`
- L659-679: `renderDealerFolder()`
- L682-682: `auth_isRestricted()`
- L693-720: `openNewDealSheet()`
- L727-744: `askSamePerson()`
- L749-880: `openPartySheet()`
- L882-895: `createDeal()`
- L900-907: `openDeal()`
- L912-966: `moneyCardHtml()`
- L968-1111: `renderDeal()`
- L1115-1178: `openStageSheet()`
- L1180-1195: `openProblemSheet()`
- L1197-1268: `openDealEditSheet()`
- L1273-1289: `saveDeal()`
- L1294-1304: `loadCalcHistory()`
- L1306-1352: `openCalcPicker()`
- L1355-1370: `calcFillsForDeal()`
- L1376-1435: `openParty()`
- L1440-1446: `reloadIndexes()`
- L1454-1457: `gate()`
- L1459-1488: `boot()`
