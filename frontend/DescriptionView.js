export class DescriptionView extends UI.VBox {
    constructor(panel) {
        super(true);
        this._panel = panel;
        this.setMinimumSize(500, 100);

        this._nodes = [];
        this._started = false;
        this._nodeForId = {};
        this._filter = (node) => true;
        this._columns = [
            {
                id: 'name',
                title: ls`Name`,
                visible: true,
                sortable: true,
                weight: 50,
            },
            {
                id: 'method',
                title: ls`Method`,
                visible: true,
                sortable: true,
                weight: 50,
            },
            {
                id: 'schema',
                title: ls`Schema`,
                visible: false,
                hideable: true,
                sortable: true,
                weight: 20,
            },
            {
                id: 'path',
                title: ls`Path`,
                visible: true,
                sortable: true,
                weight: 50,
            },
            {
                id: 'authority',
                title: ls`Authority`,
                visible: true,
                sortable: true,
                weight: 20,
            },
            {
                id: 'args',
                title: ls`Args`,
                visible: true,
                hideable: true,
                weight: 60,
            },
            {
                id: 'invoke',
                title: ls`Invoke`,
                visible: true,
                hideable: true,
                weight: 60,
            },
            {
                id: 'env',
                title: ls`Env`,
                visible: true,
                hideable: true,
                weight: 60,
            },
        ];

        // 顶部toolbar开始
        const topToolbar = new UI.Toolbar('jsna-toolbar', this.contentElement);
        // 导入导出
        const importHarButton = new UI.ToolbarButton(ls`Import description file...`, 'largeicon-load');
        // 导入 onLoadFromFile
        this._fileSelectorElement = UI.createFileSelectorElement(this.onLoadFromFile.bind(this));
        importHarButton.addEventListener(UI.ToolbarButton.Events.Click, () => this._fileSelectorElement.click(), this);
        topToolbar.appendToolbarItem(importHarButton);
        const exportHarButton = new UI.ToolbarButton(ls`Export description...`, 'largeicon-download');
        exportHarButton.addEventListener(UI.ToolbarButton.Events.Click, () => this.exportAll(), this);
        topToolbar.appendToolbarItem(exportHarButton);
        topToolbar.appendSeparator();

        const split = new UI.SplitWidget(true, true, 'jsna-split', 250);
        // 增加css
        split.registerRequiredCSS('jsna_monitor/jsna.css');

        split.show(this.contentElement);
        this._dataGrid = new DataGrid.SortableDataGrid({
            displayName: ls`jsNative Monitor`,
            columns: this._columns,
        });
        this._dataGrid.element.style.flex = '1';
        this._infoWidget = new InfoWidget();
        split.setMainWidget(this._dataGrid.asWidget());
        split.setSidebarWidget(this._infoWidget);
        this._dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, (event) =>
            this._infoWidget.render(event.data.data)
        );
        this._dataGrid.addEventListener(DataGrid.DataGrid.Events.DeselectedNode, (event) =>
            this._infoWidget.render(null)
        );
        this._dataGrid.setHeaderContextMenuCallback(this._innerHeaderContextMenu.bind(this));
        this._dataGrid.setRowContextMenuCallback(this._innerRowContextMenu.bind(this));

        // 排序
        this._dataGrid.addEventListener(DataGrid.DataGrid.Events.SortingChanged, this._sortDataGrid.bind(this));
        this._dataGrid.setStickToBottom(true);
        this._dataGrid.sortNodes(DataGrid.SortableDataGrid.StringComparator.bind(null, 'name'), false);
        this._dataGrid.sortNodes(DataGrid.SortableDataGrid.StringComparator.bind(null, 'authority'), false);
        this._dataGrid.sortNodes(DataGrid.SortableDataGrid.StringComparator.bind(null, 'path'), false);
        this._dataGrid.sortNodes(DataGrid.SortableDataGrid.StringComparator.bind(null, 'schema'), false);
        this._dataGrid.sortNodes(DataGrid.SortableDataGrid.StringComparator.bind(null, 'method'), false);
        this._updateColumnVisibility();

        // 过滤
        const keys = ['method', 'name', 'path', 'schema', 'authority'];
        this._filterParser = new TextUtils.FilterParser(keys);
        this._suggestionBuilder = new UI.FilterSuggestionBuilder(keys);

        this._textFilterUI = new UI.ToolbarInput(
            ls`Filter`,
            '',
            1,
            0.2,
            '',
            this._suggestionBuilder.completions.bind(this._suggestionBuilder)
        );
        this._textFilterUI.addEventListener(UI.ToolbarInput.Event.TextChanged, (event) => {
            const query = /** @type {string} */ (event.data);
            const filters = this._filterParser.parse(query);
            this._filter = (node) => {
                for (const {key, text, negative} of filters) {
                    if (!text) {
                        continue;
                    }
                    const data = key ? node.data[key] : node.data;
                    if (!data) {
                        continue;
                    }
                    const found = JSON.stringify(data).toLowerCase().indexOf(text.toLowerCase()) !== -1;
                    if (found === negative) {
                        return false;
                    }
                }
                return true;
            };
            this._filterNodes();
        });
        topToolbar.appendToolbarItem(this._textFilterUI);
    }
    _fileLoadFailed(message) {
        self.Common.console.error('Failed to load file with following error: ' + message);
    }
    wasShown() {
        this._apisSet = this._apisSet || new Set();
        // 事件绑定
        runtime.bridge.sendCommand('jsNative.getApis').then((apis) => {
            apis.forEach((desc) => {
                const name = desc.name;
                if (this._apisSet.has(name)) {
                    return;
                }
                this._apisSet.add(name);
                const node = new DescriptionNode({
                    name,
                    schema: desc.schema,
                    path: desc.path,
                    authority: desc.authority,
                    env: desc.env,
                    method: desc.method,
                    invoke: desc.invoke,
                    args: desc.args,
                });
                this._nodes.push(node);
                if (this._filter(node)) {
                    this._dataGrid.insertChild(node);
                }
            });
        });
    }
    async exportAll() {
        // TODO 导出json，这里可以用file API
        // const fileName = `${this._serviceName}-${new Date().toISO8601Compact()}.json`;
        // const stream = new Bindings.FileOutputStream();
        // const accepted = await stream.open(fileName);
        // if (!accepted) {
        //     return;
        // }
        // const events = this._model.getEvents(this._serviceName).filter((event) => this._acceptEvent(event));
        // await stream.write(JSON.stringify(events, undefined, 2));
        // stream.close();
    }

    async onLoadFromFile(file) {
        const outputStream = new Common.StringOutputStream();
        const reader = new Bindings.ChunkedFileReader(file, /* chunkSize */ 10000000);
        const success = await reader.read(outputStream);
        if (!success) {
            this._fileLoadFailed(reader.error().message);
            return;
        }
        let description;
        try {
            // TODO 发送数据给js-native，进行description注入
            description = JSON.parse(outputStream.data());
        } catch (e) {
            this._fileLoadFailed(e);
            return;
        }
        // TODO 注入
    }
    _filterNodes() {
        for (const node of this._nodes) {
            if (this._filter(node)) {
                if (!node.parent) {
                    this._dataGrid.insertChild(node);
                }
            } else {
                node.remove();
            }
        }
    }

    /**
     * @param {!UI.ContextSubMenu} contextMenu
     */
    _innerHeaderContextMenu(contextMenu) {
        const columnConfigs = this._columns.filter((columnConfig) => columnConfig.hideable);
        for (const columnConfig of columnConfigs) {
            contextMenu
                .headerSection()
                .appendCheckboxItem(
                    columnConfig.title,
                    this._toggleColumnVisibility.bind(this, columnConfig),
                    columnConfig.visible
                );
        }
    }

    /**
     * @param {!UI.ContextMenu} contextMenu
     * @param {!ProtocolNode} node
     */
    _innerRowContextMenu(contextMenu, node) {
        contextMenu.defaultSection().appendItem(ls`Filter`, () => {
            this._textFilterUI.setValue(`method:${node.data.method}`, true);
        });
    }

    /**
     * @param {!Object} columnConfig
     */
    _toggleColumnVisibility(columnConfig) {
        columnConfig.visible = !columnConfig.visible;
        this._updateColumnVisibility();
    }

    _updateColumnVisibility() {
        const visibleColumns = /** @type {!Object.<string, boolean>} */ ({});
        for (const columnConfig of this._columns) {
            visibleColumns[columnConfig.id] = columnConfig.visible;
        }
        this._dataGrid.setColumnsVisiblity(visibleColumns);
    }

    _sortDataGrid() {
        const sortColumnId = this._dataGrid.sortColumnId();
        if (!sortColumnId) {
            return;
        }

        let columnIsNumeric = true;
        switch (sortColumnId) {
            case 'method':
            case 'name':
            case 'schema':
            case 'path':
            case 'authority':
                columnIsNumeric = false;
                break;
        }

        const comparator = columnIsNumeric
            ? DataGrid.SortableDataGrid.NumericComparator
            : DataGrid.SortableDataGrid.StringComparator;
        this._dataGrid.sortNodes(comparator.bind(null, sortColumnId), !this._dataGrid.isSortOrderAscending());
    }
}

export class DescriptionNode extends DataGrid.SortableDataGridNode {
    constructor(data) {
        super(data);
        this.hasError = false;
    }

    /**
     * @override
     * @param {string} columnId
     * @return {!Element}
     */
    createCell(columnId) {
        switch (columnId) {
            case 'name':
            case 'method':
            case 'schema':
            case 'path':
            case 'authority':
                const cell = this.createTD(columnId);
                cell.textContent = this.data[columnId];
                return cell;
            case 'invoke':
            case 'env':
            case 'args': {
                const cell = this.createTD(columnId);
                const obj = SDK.RemoteObject.fromLocalObject(this.data[columnId]);
                cell.textContent = obj.description.trimEndWithMaxLength(50);
                cell.classList.add('source-code');
                return cell;
            }
        }
        return super.createCell(columnId);
    }

    /**
     * @override
     */
    // element() {
    //     const element = super.element();
    //     element.classList.toggle('protocol-message-sent', this.data.direction === 'sent');
    //     element.classList.toggle('protocol-message-recieved', this.data.direction !== 'sent');
    //     element.classList.toggle('error', this.hasError);
    //     return element;
    // }
}

export class InfoWidget extends UI.VBox {
    constructor() {
        super();

        this._tabbedPane = new UI.TabbedPane();
        this._tabbedPane.appendTab('args', 'Args', new UI.Widget());
        this._tabbedPane.appendTab('env', 'Env', new UI.Widget());
        this._tabbedPane.appendTab('invoke', 'Invoke', new UI.Widget());
        this._tabbedPane.show(this.contentElement);
        this._tabbedPane.selectTab('args');
        this.render(null);
    }

    render(data) {
        this._tabbedPane.setTabEnabled('invoke', true);
        if (!data) {
            this._tabbedPane.changeTabView('invoke', new UI.EmptyWidget(ls`No message selected`));
            this._tabbedPane.changeTabView('env', new UI.EmptyWidget(ls`No message selected`));
            this._tabbedPane.changeTabView('args', new UI.EmptyWidget(ls`No message selected`));
            return;
        }
        this._tabbedPane.selectTab('args');

        this._tabbedPane.changeTabView('invoke', SourceFrame.JSONView.createViewSync(data.invoke));
        this._tabbedPane.changeTabView('env', SourceFrame.JSONView.createViewSync(data.env));
        this._tabbedPane.changeTabView('args', SourceFrame.JSONView.createViewSync(data.args));
    }
}
