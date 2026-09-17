# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2754 строк)

### Секции

- L421-510: 1. Default configuration
- L511-539: 2. State
- L540-609: 3. Helpers
- L610-735: 4. Currency rates — fetch via server-side proxy, manual always wins
- L736-740: 5. Delivery lookup
- L741-745: 6. Route → RUB conversion chains
- L746-752: 7. Main calculation
- L753-2088: 8. Rendering
- L2089-2434: 9. Settings
- L2435-2566: 10. Rate editor sheet
- L2567-2611: 11. Nav + boot
- L2612-2754: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L388-396: `saveDeliveryPrefs()`
- L397-419: `loadDeliveryPrefsFromCloud()`
- L430-430: `applyStoredConfig()`
- L443-443: `getInitData()`
- L444-444: `getTg()`
- L448-456: `tgHaptic()`
- L462-465: `formHasData()`
- L466-471: `updateClosingGuard()`
- L480-493: `saveConfig()`
- L494-499: `saveHistory()`
- L504-509: `saveArchive()`
- L516-531: `defaultForm()`
- L547-547: `groupInt()`
- L548-552: `fmt()`
- L553-553: `num()`
- L560-565: `invalidateCustomsAuto()`
- L571-579: `computeAgeFromDate()`
- L584-587: `applyAgeFromDate()`
- L591-597: `formatNumInput()`
- L598-598: `cleanNumInput()`
- L604-604: `escapeHtml()`
- L605-608: `openExternal()`
- L623-628: `logRateHistory()`
- L630-655: `applyAutoRate()`
- L657-689: `fetchAutoRates()`
- L698-716: `fetchCustomsQuote()`
- L718-726: `setRawValue()`
- L728-734: `clearManualOverride()`
- L739-739: `deliveryPrice()`
- L744-744: `convertToRub()`
- L751-751: `calcDeal()`
- L793-799: `rateWidgetData()`
- L800-804: `isUpdatedToday()`
- L809-813: `rateWidgetStatus()`
- L814-826: `rateWidgetHtml()`
- L829-836: `bindRateWidget()`
- L841-850: `refreshRatesUI()`
- L855-864: `fetchCbrReference()`
- L866-872: `cbrReferenceHtml()`
- L874-906: `openRatesSheet()`
- L911-925: `ratesPreviewCardHtml()`
- L927-945: `renderTabs()`
- L947-952: `renderContent()`
- L954-954: `field()`
- L955-955: `removeFromArr()`
- L960-962: `carriedHint()`
- L966-970: `unfilledHint()`
- L971-971: `unfilledClass()`
- L975-981: `clearFieldHints()`
- L983-985: `cityOptions()`
- L990-1029: `resizeImageToBase64()`
- L1047-1103: `runListingParse()`
- L1105-1400: `renderCalc()`
- L1402-1418: `carDetailLines()`
- L1423-1427: `pushArchive()`
- L1428-1559: `showResult()`
- L1563-1565: `fmtRate()`
- L1574-1692: `buildKpHtml()`
- L1697-1728: `renderKpImageBlob()`
- L1745-1891: `shareResult()`
- L1902-1944: `bindHistorySwipe()`
- L1946-1962: `openClearHistoryConfirm()`
- L1964-1986: `openOtherRoutePicker()`
- L1993-2015: `renderArchiveList()`
- L2017-2087: `renderHistory()`
- L2104-2164: `renderSettingsView()`
- L2166-2182: `openResetConfirm()`
- L2184-2187: `fetchAdminUsers()`
- L2188-2191: `adminAction()`
- L2198-2225: `renderAdminUsersList()`
- L2226-2246: `loadAdminCard()`
- L2258-2266: `fetchDealsApi()`
- L2267-2287: `loadDealsExtraCard()`
- L2288-2304: `openDealsArchiveSheet()`
- L2305-2305: `csvCellIdx()`
- L2306-2306: `idleDaysIdx()`
- L2307-2316: `dealsCsvIdx()`
- L2317-2327: `partiesCsvIdx()`
- L2328-2371: `runDealsExport()`
- L2372-2390: `openWipeDealersConfirm()`
- L2392-2402: `routeSettingsBlock()`
- L2403-2412: `bindRouteSettings()`
- L2414-2423: `deliveryTable()`
- L2424-2433: `bindDeliveryTable()`
- L2438-2438: `openSheet()`
- L2439-2439: `closeSheet()`
- L2444-2462: `openTextFieldSheet()`
- L2508-2526: `openRateHistory()`
- L2528-2565: `openRateEditor()`
- L2591-2591: `toast()`
- L2601-2608: `syncTelegramUI()`
- L2609-2609: `renderAll()`
- L2610-2610: `startApp()`
- L2620-2634: `renderGate()`
- L2636-2748: `bootGate()`


## deals.html (1495 строк)

### Секции

- L185-323: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L324-431: 2. Утилиты и состояние
- L432-684: 3. Экран списка
- L685-897: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L898-1372: 5. Карточка сделки
- L1373-1437: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1438-1495: 8. Загрузка и гейт

### Функции

- L222-222: `stagesOf()`
- L229-237: `currentStage()`
- L238-238: `stageState()`
- L239-242: `isArchived()`
- L246-253: `lastMovementAt()`
- L254-257: `idleDays()`
- L266-268: `moneyApplies()`
- L273-276: `moneyCalc()`
- L280-288: `moneyParts()`
- L293-300: `moneyDue()`
- L305-322: `fixMoneyAmounts()`
- L339-339: `onlyDigits()`
- L340-343: `formatDivisionCode()`
- L344-351: `formatSnils()`
- L352-368: `formatPhoneRu()`
- L371-375: `bindMask()`
- L379-385: `formatDateDdMmYyyy()`
- L388-391: `formatMoney()`
- L392-395: `tsToDdMmYyyy()`
- L399-406: `parseDdMmYyyy()`
- L407-407: `toast()`
- L408-408: `openSheet()`
- L409-409: `closeSheet()`
- L412-412: `initData()`
- L414-422: `api()`
- L424-430: `pluralDays()`
- L443-484: `bindDealSwipe()`
- L486-503: `openDeleteDealConfirm()`
- L507-540: `dealRowsHtml()`
- L541-555: `bindDealRows()`
- L557-557: `activeDealsOf()`
- L559-568: `renderList()`
- L572-572: `selectTab()`
- L582-602: `renderFlatDeals()`
- L604-612: `renderArchiveList()`
- L614-620: `pluralDealers()`
- L624-658: `renderDealerFolders()`
- L660-680: `renderDealerFolder()`
- L683-683: `auth_isRestricted()`
- L694-721: `openNewDealSheet()`
- L728-745: `askSamePerson()`
- L750-881: `openPartySheet()`
- L883-896: `createDeal()`
- L901-908: `openDeal()`
- L913-967: `moneyCardHtml()`
- L969-1112: `renderDeal()`
- L1116-1179: `openStageSheet()`
- L1181-1196: `openProblemSheet()`
- L1198-1269: `openDealEditSheet()`
- L1274-1290: `saveDeal()`
- L1295-1305: `loadCalcHistory()`
- L1307-1353: `openCalcPicker()`
- L1356-1371: `calcFillsForDeal()`
- L1377-1436: `openParty()`
- L1441-1447: `reloadIndexes()`
- L1455-1458: `gate()`
- L1460-1489: `boot()`
