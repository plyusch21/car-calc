# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (3023 строк)

### Секции

- L604-693: 1. Default configuration
- L694-722: 2. State
- L723-792: 3. Helpers
- L793-918: 4. Currency rates — fetch via server-side proxy, manual always wins
- L919-923: 5. Delivery lookup
- L924-928: 6. Route → RUB conversion chains
- L929-939: 7. Main calculation
- L940-2311: 8. Rendering
- L2312-2700: 9. Settings
- L2701-2832: 10. Rate editor sheet
- L2833-2877: 11. Nav + boot
- L2878-3023: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L571-579: `saveDeliveryPrefs()`
- L580-602: `loadDeliveryPrefsFromCloud()`
- L613-613: `applyStoredConfig()`
- L626-626: `getInitData()`
- L627-627: `getTg()`
- L631-639: `tgHaptic()`
- L645-648: `formHasData()`
- L649-654: `updateClosingGuard()`
- L663-676: `saveConfig()`
- L677-682: `saveHistory()`
- L687-692: `saveArchive()`
- L699-714: `defaultForm()`
- L730-730: `groupInt()`
- L731-735: `fmt()`
- L736-736: `num()`
- L743-748: `invalidateCustomsAuto()`
- L754-762: `computeAgeFromDate()`
- L767-770: `applyAgeFromDate()`
- L774-780: `formatNumInput()`
- L781-781: `cleanNumInput()`
- L787-787: `escapeHtml()`
- L788-791: `openExternal()`
- L806-811: `logRateHistory()`
- L813-838: `applyAutoRate()`
- L840-872: `fetchAutoRates()`
- L881-899: `fetchCustomsQuote()`
- L901-909: `setRawValue()`
- L911-917: `clearManualOverride()`
- L922-922: `deliveryPrice()`
- L927-927: `convertToRub()`
- L937-937: `lockedRates()`
- L938-938: `calcDeal()`
- L980-989: `rateWidgetData()`
- L990-994: `isUpdatedToday()`
- L999-1003: `rateWidgetStatus()`
- L1004-1019: `rateWidgetHtml()`
- L1023-1031: `bindRateWidget()`
- L1036-1045: `refreshRatesUI()`
- L1050-1059: `fetchCbrReference()`
- L1061-1067: `cbrReferenceHtml()`
- L1069-1101: `openRatesSheet()`
- L1106-1120: `ratesPreviewCardHtml()`
- L1122-1140: `renderTabs()`
- L1144-1158: `renderTopbar()`
- L1160-1166: `renderContent()`
- L1168-1168: `field()`
- L1169-1169: `removeFromArr()`
- L1174-1176: `carriedHint()`
- L1180-1184: `unfilledHint()`
- L1185-1185: `unfilledClass()`
- L1189-1195: `clearFieldHints()`
- L1197-1199: `cityOptions()`
- L1204-1243: `resizeImageToBase64()`
- L1261-1317: `runListingParse()`
- L1319-1615: `renderCalc()`
- L1617-1634: `carDetailLines()`
- L1639-1643: `pushArchive()`
- L1644-1780: `showResult()`
- L1784-1786: `fmtRate()`
- L1795-1913: `buildKpHtml()`
- L1918-1949: `renderKpImageBlob()`
- L1966-2112: `shareResult()`
- L2123-2165: `bindHistorySwipe()`
- L2167-2183: `openClearHistoryConfirm()`
- L2185-2207: `openOtherRoutePicker()`
- L2214-2237: `renderArchiveList()`
- L2239-2310: `renderHistory()`
- L2330-2394: `renderSettingsView()`
- L2400-2412: `themeSettingsCard()`
- L2413-2426: `bindThemeSettings()`
- L2432-2448: `openResetConfirm()`
- L2450-2453: `fetchAdminUsers()`
- L2454-2457: `adminAction()`
- L2464-2491: `renderAdminUsersList()`
- L2492-2512: `loadAdminCard()`
- L2524-2532: `fetchDealsApi()`
- L2533-2553: `loadDealsExtraCard()`
- L2554-2570: `openDealsArchiveSheet()`
- L2571-2571: `csvCellIdx()`
- L2572-2572: `idleDaysIdx()`
- L2573-2582: `dealsCsvIdx()`
- L2583-2593: `partiesCsvIdx()`
- L2594-2637: `runDealsExport()`
- L2638-2656: `openWipeDealersConfirm()`
- L2658-2668: `routeSettingsBlock()`
- L2669-2678: `bindRouteSettings()`
- L2680-2689: `deliveryTable()`
- L2690-2699: `bindDeliveryTable()`
- L2704-2704: `openSheet()`
- L2705-2705: `closeSheet()`
- L2710-2728: `openTextFieldSheet()`
- L2774-2792: `openRateHistory()`
- L2794-2831: `openRateEditor()`
- L2857-2857: `toast()`
- L2867-2874: `syncTelegramUI()`
- L2875-2875: `renderAll()`
- L2876-2876: `startApp()`
- L2886-2900: `renderGate()`
- L2902-3017: `bootGate()`


## deals.html (1983 строк)

### Секции

- L349-550: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L551-663: 2. Утилиты и состояние
- L664-921: 3. Экран списка
- L922-1134: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L1135-1859: 5. Карточка сделки
- L1860-1924: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1925-1983: 8. Загрузка и гейт

### Функции

- L385-385: `stagesOf()`
- L392-426: `migrateStages()`
- L433-441: `currentStage()`
- L442-442: `stageState()`
- L443-446: `isArchived()`
- L450-457: `lastMovementAt()`
- L458-461: `idleDays()`
- L477-481: `idleNorm()`
- L490-492: `moneyApplies()`
- L497-500: `moneyCalc()`
- L504-512: `moneyParts()`
- L518-525: `moneyDue()`
- L532-549: `fixMoneyAmounts()`
- L571-571: `onlyDigits()`
- L572-575: `formatDivisionCode()`
- L576-583: `formatSnils()`
- L584-600: `formatPhoneRu()`
- L603-607: `bindMask()`
- L611-617: `formatDateDdMmYyyy()`
- L620-623: `formatMoney()`
- L624-627: `tsToDdMmYyyy()`
- L631-638: `parseDdMmYyyy()`
- L639-639: `toast()`
- L640-640: `openSheet()`
- L641-641: `closeSheet()`
- L644-644: `initData()`
- L646-654: `api()`
- L656-662: `pluralDays()`
- L675-716: `bindDealSwipe()`
- L718-735: `openDeleteDealConfirm()`
- L739-777: `dealRowsHtml()`
- L778-792: `bindDealRows()`
- L794-794: `activeDealsOf()`
- L796-805: `renderList()`
- L809-809: `selectTab()`
- L819-839: `renderFlatDeals()`
- L841-849: `renderArchiveList()`
- L851-857: `pluralDealers()`
- L861-895: `renderDealerFolders()`
- L897-917: `renderDealerFolder()`
- L920-920: `auth_isRestricted()`
- L931-958: `openNewDealSheet()`
- L965-982: `askSamePerson()`
- L987-1118: `openPartySheet()`
- L1120-1133: `createDeal()`
- L1138-1145: `openDeal()`
- L1151-1211: `moneyCardHtml()`
- L1213-1392: `renderDeal()`
- L1396-1506: `openStageSheet()`
- L1508-1523: `openProblemSheet()`
- L1525-1603: `openDealEditSheet()`
- L1608-1629: `saveDeal()`
- L1637-1648: `loadCalcState()`
- L1666-1669: `endOfDayTs()`
- L1670-1670: `isSameLocalDay()`
- L1671-1671: `recalcKey()`
- L1676-1775: `recalcBookedCalc()`
- L1778-1792: `calcStatusHtml()`
- L1794-1840: `openCalcPicker()`
- L1843-1858: `calcFillsForDeal()`
- L1864-1923: `openParty()`
- L1928-1934: `reloadIndexes()`
- L1942-1945: `gate()`
- L1947-1977: `boot()`
