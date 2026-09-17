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


## deals.html (1743 строк)

### Секции

- L195-353: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L354-466: 2. Утилиты и состояние
- L467-720: 3. Экран списка
- L721-933: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L934-1620: 5. Карточка сделки
- L1621-1685: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1686-1743: 8. Загрузка и гейт

### Функции

- L232-232: `stagesOf()`
- L239-247: `currentStage()`
- L248-248: `stageState()`
- L249-252: `isArchived()`
- L256-263: `lastMovementAt()`
- L264-267: `idleDays()`
- L283-287: `idleNorm()`
- L296-298: `moneyApplies()`
- L303-306: `moneyCalc()`
- L310-318: `moneyParts()`
- L323-330: `moneyDue()`
- L335-352: `fixMoneyAmounts()`
- L374-374: `onlyDigits()`
- L375-378: `formatDivisionCode()`
- L379-386: `formatSnils()`
- L387-403: `formatPhoneRu()`
- L406-410: `bindMask()`
- L414-420: `formatDateDdMmYyyy()`
- L423-426: `formatMoney()`
- L427-430: `tsToDdMmYyyy()`
- L434-441: `parseDdMmYyyy()`
- L442-442: `toast()`
- L443-443: `openSheet()`
- L444-444: `closeSheet()`
- L447-447: `initData()`
- L449-457: `api()`
- L459-465: `pluralDays()`
- L478-519: `bindDealSwipe()`
- L521-538: `openDeleteDealConfirm()`
- L542-576: `dealRowsHtml()`
- L577-591: `bindDealRows()`
- L593-593: `activeDealsOf()`
- L595-604: `renderList()`
- L608-608: `selectTab()`
- L618-638: `renderFlatDeals()`
- L640-648: `renderArchiveList()`
- L650-656: `pluralDealers()`
- L660-694: `renderDealerFolders()`
- L696-716: `renderDealerFolder()`
- L719-719: `auth_isRestricted()`
- L730-757: `openNewDealSheet()`
- L764-781: `askSamePerson()`
- L786-917: `openPartySheet()`
- L919-932: `createDeal()`
- L937-944: `openDeal()`
- L949-1003: `moneyCardHtml()`
- L1005-1174: `renderDeal()`
- L1178-1267: `openStageSheet()`
- L1269-1284: `openProblemSheet()`
- L1286-1364: `openDealEditSheet()`
- L1369-1390: `saveDeal()`
- L1398-1409: `loadCalcState()`
- L1427-1430: `endOfDayTs()`
- L1431-1431: `isSameLocalDay()`
- L1432-1432: `recalcKey()`
- L1437-1536: `recalcBookedCalc()`
- L1539-1553: `calcStatusHtml()`
- L1555-1601: `openCalcPicker()`
- L1604-1619: `calcFillsForDeal()`
- L1625-1684: `openParty()`
- L1689-1695: `reloadIndexes()`
- L1703-1706: `gate()`
- L1708-1737: `boot()`
