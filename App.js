/*global console, Ext */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    autoScroll: true,
    items: [
    { 
        xtype: 'container', itemId: 'main_box', width: 800, padding: 5, layout: { type: 'vbox' }, 
        items: [
        { 
            xtype: 'rallybutton', text: 'Target Settings',
            handler: function() {
                Ext.create( 'TargetDialog', {
                    autoShow: true,
                    draggable: true,
                    title: 'Choose Target Percentages',
                    settings: this.ownerCt.ownerCt._getTargetSettings(),
                    listeners: {
                        settingsChosen: {
                            scope: this,
                            fn: function(settings) {
                                var app = this.ownerCt.ownerCt;
                                this.ownerCt.ownerCt.target_settings = settings;
                                var new_settings = { "com.rallydev.pxs.alignment.targets": Ext.JSON.encode( settings ) };
                                console.log("New json settings", new_settings );
                                app.updateSettings( { 
                                    settings: new_settings,
                                    success: function() {console.log("saved settings");}
                                }  );
                                app._makeTargetPie(settings);
                            }
                        }
                    }
                });
            }
        }, /* button */  
        {
            xtype: 'container', itemId: 'selector_box', width: 800, padding: 5, layout: { type: 'hbox' },
            items: [
            { xtype: 'container', itemId: 'type_box', width: 260, padding: 5},
            { xtype: 'container', itemId: 'state_chooser' }
            ] /* box for selectors */
        },
        {
            xtype: 'container', itemId: 'outer_legend', width: 800, padding: 5, layout: { type: 'hbox' },
            items: [
            { xtype: 'component', html: 'Investment Categories: ', padding: 7, itemId: 'legend_label' }, 
            { xtype: 'container', itemId: 'legend', padding: 5, width: 800 } 
            ] /* box for legend */
        },
        {
            xtype: 'container', itemId: 'pie_box', width: 800, padding: 5, layout: { type: 'hbox' },
            items: [
            { 
                xtype: 'container', itemId: 'outer_target', width: 270, height: 350, layout: { type: 'vbox' }, 
                items: [
                { xtype: 'component', html: 'Target', cls: 'pie_title', padding: 5, width: 260 }, 
                { xtype: 'container', itemId: 'target_chart_box', padding: 5, width: 250  }
                ] 
            }, /* target container */
                { 
                xtype: 'container', itemId: 'outer_planned', width: 270, height: 350, layout: { type: 'vbox' }, 
                items: [ 
                { xtype: 'component', html: 'Planned', cls: 'pie_title', padding: 5, width: 260 }, 
                { xtype: 'container', itemId: 'planned_chart_box', padding: 5, cls: 'note_box', width: 250  }
                ]
            } /* planned container */
            ] /* box for pies */
        }
        ] /* end of main_box */
    }
    ],
    launch: function() {
        console.log( "started!" );
        this.colors = [ 
                    '#ACACAC',
                    '#E57E3A',
                    '#3A874F',
                    '#196C89',
                    '#E5D038',
                    '#6AB17D',
                    '#5C9ACB',
                    '#D9AF4B',
                    '#B2E3B6',
                    '#B5D8EB',
                    '#FBDE98',
                    '#FCB5B1',
                    '#B3B79A'
                ];
        this.wait = new Ext.LoadMask( Ext.getBody(), {msg: "Loading data..." } );
        this.target_settings = this.getSetting("com.rallydev.pxs.alignment.targets");
        
        if ( this.target_settings ) {
            this.target_settings = Ext.JSON.decode( this.target_settings );
        }
        
        console.log( "got target settings:", this.target_settings );
        this.StateStore = null;
        this.chosen_state = "-- All --";
        this._getTargetDistribution();
        this._getLowestTypeName();
    },
    _getTargetSettings: function() {
        console.log( "_getTargetSettings", this.target_settings);
        var targets = [];
        Ext.Array.each( this.target_settings, function(setting) {
            var target = {
                total: setting.total,
                name: setting.name,
                hover_text: setting.name + ":<br/>" + setting.total + "%",
                slice_text: setting.total + "%"
            };
            if ( target.total === null || target.total === 0 ) { target.slice_text = ""; }
            
            targets.push(target);
        });
        return this.target_settings;
    },
    _addStateChooser: function() {
        console.log('_addStateChooser', this.type_name );
        if ( ! this.StateChooser ) { 
            var all_value = { 
                Name: '-- All --',
                _refObjectName: '-- All --',
                ObjectID: '0',
                _ref: '/state/0',
                OrderIndex: -1
            };
            this.StateStore = Ext.create( 'Rally.data.WsapiDataStore', {
                model: 'State',
                autoLoad: true,
                fetch: [ 'Name' ],
                listeners: {
                    load: function(store,data) {
                        console.log("state_store loading...");
                        store.insert(0,all_value);
                    },
                    scope: this
                },
                sorters: [{ property: 'OrderIndex', direction: 'ASC' }],
                filters: [{
                    property: 'TypeDef.Name',
                    operator: '=',
                    value: this.type_name
                }]
            });
            
            this.StateChooser = Ext.create( 'Rally.ui.combobox.ComboBox', {
                store: this.StateStore,
                queryMode: 'local',
                fieldLabel: 'State',
                labelPad: 2,
                labelWidth: 30,
                width: 300,
                listeners: {
                    change: function( chooser, selectedValue, oldValue, options ) {
                        this.chosen_state = chooser.getRawValue();
                        this._getLowestTypeName();
                    },
                    scope: this
                }
            } );
            this.down('#state_chooser').add(this.StateChooser);
        }
    },
    _getLowestTypeName: function() {
        console.log("_getLowestTypeName" );
        this.wait.show();
        Ext.create( 'Rally.data.WsapiDataStore', {
            model: 'TypeDefinition',
            autoLoad: true,
            fetch: [ 'Name', 'OrdinalValue', 'TypePath' ],
            filters: [{
                property: 'Parent.Name',
                operator: '=',
                value: 'Portfolio Item'
            },
            {
                property: 'Ordinal',
                operator: '=',
                value: '0'
            }],
            listeners: {
                load: function(store,data) {
                    console.log( "Type Datastore loaded", data );
                    var lowest_item = data[0];
                    this.type_name = lowest_item.data.Name;
                    this.type_path = lowest_item.data.TypePath;
                    this.down("#type_box").update(this.type_name);
                    console.log("lowest type:", this.type_name);
                    this._addStateChooser();
                    this._getPlannedItems();
                },
                scope: this
            }
        });
    },
    _getTargetDistribution: function() {
        console.log( "_getTargetDistribution" );
        var that = this;
        var query = Ext.create('Rally.data.QueryFilter', {
            property: 'Name', operator: "=", value: 'Portfolio Item'
        });
        
        if ( ! this.target_settings ) {
            var type_def_store = Ext.create('Rally.data.WsapiDataStore', {
                model: 'TypeDefinition',
                autoLoad: true,
                fetch: 'Name,Attributes,AllowedValues,ElementName',
                listeners: {
                    load: function(store,data) { 
                        // console.log(data);
                        var categories = [];
                        Ext.Array.each( data[0].data.Attributes, function(field) {
                            if ( field.ElementName === "InvestmentCategory") {
                                var standard_spread = Math.round( 100 / field.AllowedValues.length );
                                Ext.Array.each( field.AllowedValues, function(category) {
                                    if ( category.StringValue === "" ) { category.StringValue = "None"; }
                                    var target = {
                                        name: category.StringValue,
                                        total: standard_spread,
                                        hover_text: category.StringValue + ":<br/>" + standard_spread + "%",
                                        slice_text: standard_spread + "%"
                                    };
                                    if ( target.total === null || target.total === 0 ) { target.slice_text = ""; }
                                    categories.push(target);
                                });
                                that.target_settings = categories;
                                that._makeTargetPie(categories);
                            }
                        });
                    },
                    scope: that
                },
                filters: query
            });
        } else {
            this._makeTargetPie( this._getTargetSettings() );
        }
    },
    _getPlannedItems: function() {
        console.log("_getPlannedItems");
        var fetch = [ 'FormattedID','Name','PreliminaryEstimate','Value','InvestmentCategory' ];
        var query = Ext.create('Rally.data.QueryFilter', {
                property: 'PortfolioItemType.Name',
                operator: '=',
                value: this.type_name
            });
        if ( this.chosen_state !== "-- All --" ) {
            var additional_query = Ext.create('Rally.data.QueryFilter', {
                property: 'State.Name',
                operator: '=',
                value: this.chosen_state
            });
            query = query.and( additional_query );
        }
        
        Ext.create('Rally.data.WsapiDataStore', {
            model: 'PortfolioItem',
            autoLoad: true,
            fetch: fetch,
            groupField: 'InvestmentCategory',
            limit: Infinity,
            listeners: {
                load: function(store,data) {
                    this._makePlannedPie(store);
                },
                scope: this
            },
            filters: query
        });
    },
    _makeTargetPie: function(categories) {
        console.log("_makeTargetPie", categories );
        
        var ordered_data_set = this._getOrderedDataSet( categories );
        Ext.Array.each( ordered_data_set, function(item) {
            item.hover_text = item.name + ":<br/>" + item.total + "%";
            item.slice_text = item.total + "%";
            if ( item.total === null || item.total === 0 ) { item.slice_text = ""; }
        });
        var calculated_store = Ext.create('Ext.data.JsonStore', {
            fields: ['name','total','hover_text','slice_text'],
            data: ordered_data_set
        });
        
        if ( this.target_chart ) { this.target_chart.destroy(); }
        this.target_chart = this._getChart(calculated_store);
        this.down('#target_chart_box').add( this.target_chart );
    },
    _makePlannedPie: function(store) {
        console.log("_makePlannedPie", store );
        console.log( store.getGroups() );
        var group_array = store.getGroups();
        
        if ( this.planned_chart ) { this.planned_chart.destroy(); }
        if ( group_array.length === 0 ) {
            this.planned_chart = Ext.create( 'Ext.Component', { html: "No Planned work" });
        } else {
            var data_set = [];
            var overall_total = 0;
            Ext.Array.each( group_array, function(group) {
                var group_total = 0;
                var group_name = group.name;
                Ext.Array.each( group.children, function(child) {
                    var child_value = 0;
                    if ( child.data.PreliminaryEstimate ) {
                        child_value = child.data.PreliminaryEstimate.Value;
                    }
                    group_total += child_value;
                });
                overall_total += group_total;
                data_set.push({ 
                    name: group_name, 
                    total: group_total 
                });
            });
            
            Ext.Array.each( data_set, function(item){
                var ratio = Math.round(100 * item.total / overall_total);
                item.hover_text = item.name + ":<br/>" + item.total + " points (" + ratio + "%)";
                item.slice_text = ratio + "%";
                if ( item.total === null || item.total === 0 ) { item.slice_text = ""; }
            });
            console.log( data_set );
            var ordered_data_set = this._getOrderedDataSet( data_set );
            
            var calculated_store = Ext.create('Ext.data.JsonStore', {
                fields: ['name','total','hover_text','slice_text'],
                data: ordered_data_set
            });
            
            this.planned_chart = this._getChart(calculated_store);
        }
        this.wait.hide();
        this.down('#planned_chart_box').add( this.planned_chart );
    },
    _updateLegend: function(store) {
        console.log("_updateLegend");
        var that = this;
        
        var number_of_colors = store.data.items.length;
        
        if ( this.legend_table ) { this.legend_table.destroy(); }
        this.legend_table = Ext.create( 'Ext.panel.Panel', { 
            border: 0,
            layout: { type: 'table', columns: number_of_colors * 2 },
            defaults: { border: 0, bodyStyle: 'padding:2px' }
        } );
        Ext.Array.each( store.data.items, function(record, index) {
            that.legend_table.add( { html: '<div style="background-color: ' + that.colors[index] + '">&nbsp;&nbsp;&nbsp;</div>',  style: { background: that.colors[index] } } );
            that.legend_table.add( { html: record.data.name + "&nbsp;&nbsp;" } );
        });
        this.down('#legend').add(this.legend_table);
    },
    _getChart: function(store) {
        console.log("_getChart",store);
        this._updateLegend( store );
        var chart = Ext.create( 'Ext.chart.Chart', {
            width: 240,
            height: 240,
            animate: false,
            store: store,
            /*
            legend: {
                position: 'right',
                vertical: true
            },
            */
            series: [{
                type: 'pie',
                field: 'total',
                showInLegend: true,
                /*
                highlight: {
                    segment: {
                        margin: 5
                    }
                }, 
                */
                colorSet: this.colors,
                label: {
                    field: 'slice_text',
                    display: 'middle',
                    contrast: true,
                    font: '10px Arial'
                }, 
                tips: {
                    trackMouse: true,
                    width: 150,
                    height: 40,
                    renderer: function(storeItem, item) {
                        this.setTitle(storeItem.get('hover_text'));
                    }
                }
            }]
        });
        return chart;
    },
    /* for making sure all the same names are in the same order (assuming both have "names")
     * so that we use the same colors in both pies
     */
    _getOrderedDataSet: function( unordered_data_set ) {
        console.log( "_getOrderedDataSet", unordered_data_set );
        var settings = this._getTargetSettings();
        
        var ordered_data_set = [];
        Ext.Array.each( settings, function( item ) {
            var ordered_item = {
                name: item.name,
                total: 0
            };
            
            Ext.Array.each( unordered_data_set, function( u_item ) {
                if ( u_item.name === ordered_item.name ) {
                    ordered_item.total = u_item.total;
                    ordered_item.hover_text = u_item.hover_text;
                    ordered_item.slice_text = u_item.slice_text;
                }
            });
            
            ordered_data_set.push( ordered_item );
        });
        return ordered_data_set;
    },
    /* hack for p2 problem */
    updateSettings: function(options){
        var appID = this.getContext().get('appID');
        var project = this.getContext().getProject();
        
        console.log("project", project );
        console.log("appID", appID);
        //Rally.data.PreferenceManager.updateAppPreferences({
        Rally.data.PreferenceManager.update({
            appID: appID,
            settings: options.settings,
            success: function(updatedSettings){
                Ext.apply(this.settings, updatedSettings);

                if(options.success){
                    options.success.call(options.scope);
                }
            },
            scope: this
        });
    }
});
