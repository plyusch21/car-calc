# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2776 строк)

### Секции

- L421-510: 1. Default configuration
- L511-539: 2. State
- L540-609: 3. Helpers
- L610-735: 4. Currency rates — fetch via server-side proxy, manual always wins
- L736-740: 5. Delivery lookup
- L741-745: 6. Route → RUB conversion chains
- L746-756: 7. Main calculation
- L757-2107: 8. Rendering
- L2108-2453: 9. Settings
- L2454-2585: 10. Rate editor sheet
- L2586-2630: 11. Nav + boot
- L2631-2776: 12. Доступ через Telegram — приложение работает только как Mini App.

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
- L754-754: `lockedRates()`
- L755-755: `calcDeal()`
- L797-806: `rateWidgetData()`
- L807-811: `isUpdatedToday()`
- L816-820: `rateWidgetStatus()`
- L821-838: `rateWidgetHtml()`
- L842-850: `bindRateWidget()`
- L855-864: `refreshRatesUI()`
- L869-878: `fetchCbrReference()`
- L880-886: `cbrReferenceHtml()`
- L888-920: `openRatesSheet()`
- L925-939: `ratesPreviewCardHtml()`
- L941-959: `renderTabs()`
- L961-966: `renderContent()`
- L968-968: `field()`
- L969-969: `removeFromArr()`
- L974-976: `carriedHint()`
- L980-984: `unfilledHint()`
- L985-985: `unfilledClass()`
- L989-995: `clearFieldHints()`
- L997-999: `cityOptions()`
- L1004-1043: `resizeImageToBase64()`
- L1061-1117: `runListingParse()`
- L1119-1414: `renderCalc()`
- L1416-1432: `carDetailLines()`
- L1437-1441: `pushArchive()`
- L1442-1578: `showResult()`
- L1582-1584: `fmtRate()`
- L1593-1711: `buildKpHtml()`
- L1716-1747: `renderKpImageBlob()`
- L1764-1910: `shareResult()`
- L1921-1963: `bindHistorySwipe()`
- L1965-1981: `openClearHistoryConfirm()`
- L1983-2005: `openOtherRoutePicker()`
- L2012-2034: `renderArchiveList()`
- L2036-2106: `renderHistory()`
- L2123-2183: `renderSettingsView()`
- L2185-2201: `openResetConfirm()`
- L2203-2206: `fetchAdminUsers()`
- L2207-2210: `adminAction()`
- L2217-2244: `renderAdminUsersList()`
- L2245-2265: `loadAdminCard()`
- L2277-2285: `fetchDealsApi()`
- L2286-2306: `loadDealsExtraCard()`
- L2307-2323: `openDealsArchiveSheet()`
- L2324-2324: `csvCellIdx()`
- L2325-2325: `idleDaysIdx()`
- L2326-2335: `dealsCsvIdx()`
- L2336-2346: `partiesCsvIdx()`
- L2347-2390: `runDealsExport()`
- L2391-2409: `openWipeDealersConfirm()`
- L2411-2421: `routeSettingsBlock()`
- L2422-2431: `bindRouteSettings()`
- L2433-2442: `deliveryTable()`
- L2443-2452: `bindDeliveryTable()`
- L2457-2457: `openSheet()`
- L2458-2458: `closeSheet()`
- L2463-2481: `openTextFieldSheet()`
- L2527-2545: `openRateHistory()`
- L2547-2584: `openRateEditor()`
- L2610-2610: `toast()`
- L2620-2627: `syncTelegramUI()`
- L2628-2628: `renderAll()`
- L2629-2629: `startApp()`
- L2639-2653: `renderGate()`
- L2655-2770: `bootGate()`


## deals.html (1698 строк)

### Секции

- L185-323: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L324-436: 2. Утилиты и состояние
- L437-689: 3. Экран списка
- L690-902: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L903-1575: 5. Карточка сделки
- L1576-1640: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1641-1698: 8. Загрузка и гейт

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
- L344-344: `onlyDigits()`
- L345-348: `formatDivisionCode()`
- L349-356: `formatSnils()`
- L357-373: `formatPhoneRu()`
- L376-380: `bindMask()`
- L384-390: `formatDateDdMmYyyy()`
- L393-396: `formatMoney()`
- L397-400: `tsToDdMmYyyy()`
- L404-411: `parseDdMmYyyy()`
- L412-412: `toast()`
- L413-413: `openSheet()`
- L414-414: `closeSheet()`
- L417-417: `initData()`
- L419-427: `api()`
- L429-435: `pluralDays()`
- L448-489: `bindDealSwipe()`
- L491-508: `openDeleteDealConfirm()`
- L512-545: `dealRowsHtml()`
- L546-560: `bindDealRows()`
- L562-562: `activeDealsOf()`
- L564-573: `renderList()`
- L577-577: `selectTab()`
- L587-607: `renderFlatDeals()`
- L609-617: `renderArchiveList()`
- L619-625: `pluralDealers()`
- L629-663: `renderDealerFolders()`
- L665-685: `renderDealerFolder()`
- L688-688: `auth_isRestricted()`
- L699-726: `openNewDealSheet()`
- L733-750: `askSamePerson()`
- L755-886: `openPartySheet()`
- L888-901: `createDeal()`
- L906-913: `openDeal()`
- L918-972: `moneyCardHtml()`
- L974-1136: `renderDeal()`
- L1140-1229: `openStageSheet()`
- L1231-1246: `openProblemSheet()`
- L1248-1319: `openDealEditSheet()`
- L1324-1345: `saveDeal()`
- L1353-1364: `loadCalcState()`
- L1382-1385: `endOfDayTs()`
- L1386-1386: `isSameLocalDay()`
- L1387-1387: `recalcKey()`
- L1392-1491: `recalcBookedCalc()`
- L1494-1508: `calcStatusHtml()`
- L1510-1556: `openCalcPicker()`
- L1559-1574: `calcFillsForDeal()`
- L1580-1639: `openParty()`
- L1644-1650: `reloadIndexes()`
- L1658-1661: `gate()`
- L1663-1692: `boot()`
