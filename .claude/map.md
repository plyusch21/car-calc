# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2777 строк)

### Секции

- L422-511: 1. Default configuration
- L512-540: 2. State
- L541-610: 3. Helpers
- L611-736: 4. Currency rates — fetch via server-side proxy, manual always wins
- L737-741: 5. Delivery lookup
- L742-746: 6. Route → RUB conversion chains
- L747-757: 7. Main calculation
- L758-2108: 8. Rendering
- L2109-2454: 9. Settings
- L2455-2586: 10. Rate editor sheet
- L2587-2631: 11. Nav + boot
- L2632-2777: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L389-397: `saveDeliveryPrefs()`
- L398-420: `loadDeliveryPrefsFromCloud()`
- L431-431: `applyStoredConfig()`
- L444-444: `getInitData()`
- L445-445: `getTg()`
- L449-457: `tgHaptic()`
- L463-466: `formHasData()`
- L467-472: `updateClosingGuard()`
- L481-494: `saveConfig()`
- L495-500: `saveHistory()`
- L505-510: `saveArchive()`
- L517-532: `defaultForm()`
- L548-548: `groupInt()`
- L549-553: `fmt()`
- L554-554: `num()`
- L561-566: `invalidateCustomsAuto()`
- L572-580: `computeAgeFromDate()`
- L585-588: `applyAgeFromDate()`
- L592-598: `formatNumInput()`
- L599-599: `cleanNumInput()`
- L605-605: `escapeHtml()`
- L606-609: `openExternal()`
- L624-629: `logRateHistory()`
- L631-656: `applyAutoRate()`
- L658-690: `fetchAutoRates()`
- L699-717: `fetchCustomsQuote()`
- L719-727: `setRawValue()`
- L729-735: `clearManualOverride()`
- L740-740: `deliveryPrice()`
- L745-745: `convertToRub()`
- L755-755: `lockedRates()`
- L756-756: `calcDeal()`
- L798-807: `rateWidgetData()`
- L808-812: `isUpdatedToday()`
- L817-821: `rateWidgetStatus()`
- L822-839: `rateWidgetHtml()`
- L843-851: `bindRateWidget()`
- L856-865: `refreshRatesUI()`
- L870-879: `fetchCbrReference()`
- L881-887: `cbrReferenceHtml()`
- L889-921: `openRatesSheet()`
- L926-940: `ratesPreviewCardHtml()`
- L942-960: `renderTabs()`
- L962-967: `renderContent()`
- L969-969: `field()`
- L970-970: `removeFromArr()`
- L975-977: `carriedHint()`
- L981-985: `unfilledHint()`
- L986-986: `unfilledClass()`
- L990-996: `clearFieldHints()`
- L998-1000: `cityOptions()`
- L1005-1044: `resizeImageToBase64()`
- L1062-1118: `runListingParse()`
- L1120-1415: `renderCalc()`
- L1417-1433: `carDetailLines()`
- L1438-1442: `pushArchive()`
- L1443-1579: `showResult()`
- L1583-1585: `fmtRate()`
- L1594-1712: `buildKpHtml()`
- L1717-1748: `renderKpImageBlob()`
- L1765-1911: `shareResult()`
- L1922-1964: `bindHistorySwipe()`
- L1966-1982: `openClearHistoryConfirm()`
- L1984-2006: `openOtherRoutePicker()`
- L2013-2035: `renderArchiveList()`
- L2037-2107: `renderHistory()`
- L2124-2184: `renderSettingsView()`
- L2186-2202: `openResetConfirm()`
- L2204-2207: `fetchAdminUsers()`
- L2208-2211: `adminAction()`
- L2218-2245: `renderAdminUsersList()`
- L2246-2266: `loadAdminCard()`
- L2278-2286: `fetchDealsApi()`
- L2287-2307: `loadDealsExtraCard()`
- L2308-2324: `openDealsArchiveSheet()`
- L2325-2325: `csvCellIdx()`
- L2326-2326: `idleDaysIdx()`
- L2327-2336: `dealsCsvIdx()`
- L2337-2347: `partiesCsvIdx()`
- L2348-2391: `runDealsExport()`
- L2392-2410: `openWipeDealersConfirm()`
- L2412-2422: `routeSettingsBlock()`
- L2423-2432: `bindRouteSettings()`
- L2434-2443: `deliveryTable()`
- L2444-2453: `bindDeliveryTable()`
- L2458-2458: `openSheet()`
- L2459-2459: `closeSheet()`
- L2464-2482: `openTextFieldSheet()`
- L2528-2546: `openRateHistory()`
- L2548-2585: `openRateEditor()`
- L2611-2611: `toast()`
- L2621-2628: `syncTelegramUI()`
- L2629-2629: `renderAll()`
- L2630-2630: `startApp()`
- L2640-2654: `renderGate()`
- L2656-2771: `bootGate()`


## deals.html (1824 строк)

### Секции

- L196-397: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L398-510: 2. Утилиты и состояние
- L511-767: 3. Экран списка
- L768-980: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L981-1701: 5. Карточка сделки
- L1702-1766: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1767-1824: 8. Загрузка и гейт

### Функции

- L232-232: `stagesOf()`
- L239-273: `migrateStages()`
- L280-288: `currentStage()`
- L289-289: `stageState()`
- L290-293: `isArchived()`
- L297-304: `lastMovementAt()`
- L305-308: `idleDays()`
- L324-328: `idleNorm()`
- L337-339: `moneyApplies()`
- L344-347: `moneyCalc()`
- L351-359: `moneyParts()`
- L365-372: `moneyDue()`
- L379-396: `fixMoneyAmounts()`
- L418-418: `onlyDigits()`
- L419-422: `formatDivisionCode()`
- L423-430: `formatSnils()`
- L431-447: `formatPhoneRu()`
- L450-454: `bindMask()`
- L458-464: `formatDateDdMmYyyy()`
- L467-470: `formatMoney()`
- L471-474: `tsToDdMmYyyy()`
- L478-485: `parseDdMmYyyy()`
- L486-486: `toast()`
- L487-487: `openSheet()`
- L488-488: `closeSheet()`
- L491-491: `initData()`
- L493-501: `api()`
- L503-509: `pluralDays()`
- L522-563: `bindDealSwipe()`
- L565-582: `openDeleteDealConfirm()`
- L586-623: `dealRowsHtml()`
- L624-638: `bindDealRows()`
- L640-640: `activeDealsOf()`
- L642-651: `renderList()`
- L655-655: `selectTab()`
- L665-685: `renderFlatDeals()`
- L687-695: `renderArchiveList()`
- L697-703: `pluralDealers()`
- L707-741: `renderDealerFolders()`
- L743-763: `renderDealerFolder()`
- L766-766: `auth_isRestricted()`
- L777-804: `openNewDealSheet()`
- L811-828: `askSamePerson()`
- L833-964: `openPartySheet()`
- L966-979: `createDeal()`
- L984-991: `openDeal()`
- L997-1057: `moneyCardHtml()`
- L1059-1234: `renderDeal()`
- L1238-1348: `openStageSheet()`
- L1350-1365: `openProblemSheet()`
- L1367-1445: `openDealEditSheet()`
- L1450-1471: `saveDeal()`
- L1479-1490: `loadCalcState()`
- L1508-1511: `endOfDayTs()`
- L1512-1512: `isSameLocalDay()`
- L1513-1513: `recalcKey()`
- L1518-1617: `recalcBookedCalc()`
- L1620-1634: `calcStatusHtml()`
- L1636-1682: `openCalcPicker()`
- L1685-1700: `calcFillsForDeal()`
- L1706-1765: `openParty()`
- L1770-1776: `reloadIndexes()`
- L1784-1787: `gate()`
- L1789-1818: `boot()`
