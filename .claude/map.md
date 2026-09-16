# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2918 строк)

### Секции

- L392-619: 1. Default configuration
- L620-652: 2. State
- L653-722: 3. Helpers
- L723-879: 4. Currency rates — fetch via server-side proxy, manual always wins
- L880-888: 5. Delivery lookup
- L889-901: 6. Route → RUB conversion chains
- L902-932: 7. Main calculation
- L933-2262: 8. Rendering
- L2263-2608: 9. Settings
- L2609-2739: 10. Rate editor sheet
- L2740-2784: 11. Nav + boot
- L2785-2918: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L359-367: `saveDeliveryPrefs()`
- L368-390: `loadDeliveryPrefsFromCloud()`
- L501-520: `mergeRatesState()`
- L527-538: `mergeRoutesState()`
- L539-544: `applyStoredConfig()`
- L557-557: `getInitData()`
- L558-558: `getTg()`
- L562-570: `tgHaptic()`
- L579-592: `saveConfig()`
- L593-598: `saveHistory()`
- L603-608: `saveArchive()`
- L609-618: `deepMerge()`
- L625-640: `defaultForm()`
- L660-660: `groupInt()`
- L661-665: `fmt()`
- L666-666: `num()`
- L673-678: `invalidateCustomsAuto()`
- L684-692: `computeAgeFromDate()`
- L697-700: `applyAgeFromDate()`
- L704-710: `formatNumInput()`
- L711-711: `cleanNumInput()`
- L717-717: `escapeHtml()`
- L718-721: `openExternal()`
- L736-741: `logRateHistory()`
- L743-768: `applyAutoRate()`
- L770-802: `fetchAutoRates()`
- L811-860: `fetchCustomsQuote()`
- L862-870: `setRawValue()`
- L872-878: `clearManualOverride()`
- L883-887: `deliveryPrice()`
- L892-900: `convertToRub()`
- L905-931: `calcDeal()`
- L973-979: `rateWidgetData()`
- L980-984: `isUpdatedToday()`
- L989-993: `rateWidgetStatus()`
- L994-1006: `rateWidgetHtml()`
- L1009-1016: `bindRateWidget()`
- L1021-1030: `refreshRatesUI()`
- L1035-1044: `fetchCbrReference()`
- L1046-1052: `cbrReferenceHtml()`
- L1054-1086: `openRatesSheet()`
- L1091-1105: `ratesPreviewCardHtml()`
- L1107-1125: `renderTabs()`
- L1127-1132: `renderContent()`
- L1134-1134: `field()`
- L1135-1135: `removeFromArr()`
- L1140-1142: `carriedHint()`
- L1146-1150: `unfilledHint()`
- L1151-1151: `unfilledClass()`
- L1155-1161: `clearFieldHints()`
- L1163-1165: `cityOptions()`
- L1170-1209: `resizeImageToBase64()`
- L1227-1283: `runListingParse()`
- L1285-1578: `renderCalc()`
- L1580-1596: `carDetailLines()`
- L1601-1605: `pushArchive()`
- L1606-1733: `showResult()`
- L1737-1739: `fmtRate()`
- L1748-1866: `buildKpHtml()`
- L1871-1902: `renderKpImageBlob()`
- L1919-2065: `shareResult()`
- L2076-2118: `bindHistorySwipe()`
- L2120-2136: `openClearHistoryConfirm()`
- L2138-2160: `openOtherRoutePicker()`
- L2167-2189: `renderArchiveList()`
- L2191-2261: `renderHistory()`
- L2278-2338: `renderSettingsView()`
- L2340-2356: `openResetConfirm()`
- L2358-2361: `fetchAdminUsers()`
- L2362-2365: `adminAction()`
- L2372-2399: `renderAdminUsersList()`
- L2400-2420: `loadAdminCard()`
- L2432-2440: `fetchDealsApi()`
- L2441-2461: `loadDealsExtraCard()`
- L2462-2478: `openDealsArchiveSheet()`
- L2479-2479: `csvCellIdx()`
- L2480-2480: `idleDaysIdx()`
- L2481-2490: `dealsCsvIdx()`
- L2491-2501: `partiesCsvIdx()`
- L2502-2545: `runDealsExport()`
- L2546-2564: `openWipeDealersConfirm()`
- L2566-2576: `routeSettingsBlock()`
- L2577-2586: `bindRouteSettings()`
- L2588-2597: `deliveryTable()`
- L2598-2607: `bindDeliveryTable()`
- L2612-2612: `openSheet()`
- L2613-2613: `closeSheet()`
- L2618-2635: `openTextFieldSheet()`
- L2681-2699: `openRateHistory()`
- L2701-2738: `openRateEditor()`
- L2764-2764: `toast()`
- L2774-2781: `syncTelegramUI()`
- L2782-2782: `renderAll()`
- L2783-2783: `startApp()`
- L2793-2807: `renderGate()`
- L2809-2912: `bootGate()`


## deals.html (1298 строк)

### Секции

- L152-225: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L226-333: 2. Утилиты и состояние
- L334-579: 3. Экран списка
- L580-792: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L793-1184: 5. Карточка сделки
- L1185-1249: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1250-1298: 8. Загрузка и гейт

### Функции

- L189-189: `stagesOf()`
- L196-204: `currentStage()`
- L205-205: `stageState()`
- L206-209: `isArchived()`
- L213-220: `lastMovementAt()`
- L221-224: `idleDays()`
- L241-241: `onlyDigits()`
- L242-245: `formatDivisionCode()`
- L246-253: `formatSnils()`
- L254-270: `formatPhoneRu()`
- L273-277: `bindMask()`
- L281-287: `formatDateDdMmYyyy()`
- L290-293: `formatMoney()`
- L294-297: `tsToDdMmYyyy()`
- L301-308: `parseDdMmYyyy()`
- L309-309: `toast()`
- L310-310: `openSheet()`
- L311-311: `closeSheet()`
- L314-314: `initData()`
- L316-324: `api()`
- L326-332: `pluralDays()`
- L345-386: `bindDealSwipe()`
- L388-405: `openDeleteDealConfirm()`
- L409-442: `dealRowsHtml()`
- L443-457: `bindDealRows()`
- L459-459: `activeDealsOf()`
- L461-470: `renderList()`
- L474-474: `selectTab()`
- L484-504: `renderFlatDeals()`
- L506-514: `renderArchiveList()`
- L519-553: `renderDealerFolders()`
- L555-575: `renderDealerFolder()`
- L578-578: `auth_isRestricted()`
- L589-616: `openNewDealSheet()`
- L623-640: `askSamePerson()`
- L645-776: `openPartySheet()`
- L778-791: `createDeal()`
- L796-803: `openDeal()`
- L805-935: `renderDeal()`
- L939-996: `openStageSheet()`
- L998-1013: `openProblemSheet()`
- L1015-1086: `openDealEditSheet()`
- L1091-1107: `saveDeal()`
- L1112-1122: `loadCalcHistory()`
- L1124-1164: `openCalcPicker()`
- L1167-1183: `calcFillsForDeal()`
- L1189-1248: `openParty()`
- L1253-1259: `reloadIndexes()`
- L1267-1270: `gate()`
- L1272-1292: `boot()`
