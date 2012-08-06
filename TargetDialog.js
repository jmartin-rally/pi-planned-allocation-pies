/*global console, Ext */
Ext.define('TargetDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    width: 320,
    padding: '5px',
    items: [{
        xtype: 'panel',
        layout: { type: 'vbox' },
        itemId: 'dialog_box',
        height: 300,
        autoScroll: true,
        defaults: {
            padding: 5
        }
    }],
    constructor: function( cfg ) {
        this.callParent(arguments);
        this.initConfig(cfg);
    },
    initComponent: function() {
        this.callParent(arguments);
        this.addEvents(
                /**
                 * @event settingsChosen
                 * Fires when user clicks OK after modifying settings
                 * @param {Hash} checkbox_settings
                 */
                'settingsChosen'
        );
        var holding_hash = {};
        var previous_array = this.settings || [];
        Ext.Array.each( previous_array, function( item ) {
            console.log( "setting", item.name, item.total );
            holding_hash[ item.name ] = item.total;
        });
        this.previous_values = holding_hash;
        
        this.InvestmentCategoryNames = [];
        this.InvestmentCategoryBoxes = {};
        this._placeAttributeBoxes();
        this._placeButtons();
    },
    _placeAttributeBoxes: function() {
        console.log( "_placeAttributeBoxes" );
        var that = this;
        var query = Ext.create('Rally.data.QueryFilter', {
            property: 'Name', operator: "=", value: 'Portfolio Item'
        });
        
        Ext.create('Rally.data.WsapiDataStore', {
            model: 'TypeDefinition',
            autoLoad: true,
            fetch: 'Name,Attributes,AllowedValues,ElementName',
            listeners: {
                load: function(store,data) { 
                    var categories = [];
                    Ext.Array.each( data[0].data.Attributes, function(field) {
                        if ( field.ElementName === "InvestmentCategory") {
                            var standard_spread = Math.round( 100 / field.AllowedValues.length );
                            Ext.Array.each( field.AllowedValues, function(category) {
                                if ( category.StringValue === "" ) { category.StringValue = "None"; }
                                category.total = 0;
                                if ( that.previous_values[category.StringValue] ) {
                                    category.total = that.previous_values[category.StringValue];
                                    console.log( category.StringValue, category.total );
                                }
                                
                                category.name = category.StringValue;
                                console.log( category );
                                that._addAttributeBox( category );
                            });
                        }
                    });
                },
                scope: this
            },
            filters: query
        });
    },
    _addAttributeBox: function( category ) {
        console.log( "_addAttributeBox", category );
        Ext.apply(Ext.form.field.VTypes, {
            PositiveInteger: function(v) {
                if ( /\D+/.test(v) ) {
                    return false;
                } else {
                    if ( v < 0 || v > 100 ) {
                        return false;
                    } else {
                        return true;
                    }
                }
            },
            PositiveIntegerText: 'Must be positive integer less than or equal to 100',
            PositiveIntegerMask: /\d/i
        });
        
        var container = Ext.create( 'Ext.container.Container', {
            width: 289
        } );
        
        var box = Ext.create( 'Rally.ui.NumberField', {
            value: category.total, 
            fieldLabel: category.name, 
            vtype: 'PositiveInteger'
        });
        container.add(box);
        this.InvestmentCategoryNames.push( category.name );
        this.InvestmentCategoryBoxes[ category.name ] = box;
        this.down('#dialog_box').add(container);
    },
    _checkValues: function() {
        var total = 0;
        var boxes = this.InvestmentCategoryBoxes;
        console.log( "box hash", boxes );
        Ext.each( this.InvestmentCategoryNames, function( category_name ) {
            console.log( category_name );
            var box = boxes[category_name];
            total += box.getValue();
            console.log(total);
        });
        if ( total !== 100 ) {
            Ext.MessageBox.alert( "Bad Total","Total must not exceed 100%");
            return false;
        } else {
            return true;
        }
        
    },
    _getChoices: function() {
           var boxes = this.InvestmentCategoryBoxes;
           var category_array = [];
        Ext.each( this.InvestmentCategoryNames, function( category_name ) {
            console.log( category_name );
            var box = boxes[category_name];
            category_array.push( { name: category_name, total: box.getValue() });
        });
        var settings = category_array;
        return settings;
    },
    _placeButtons: function() {
        this.down('#dialog_box').addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '0 0 10 0',
            layout: {
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    text: "OK",
                    scope: this,
                    userAction: 'clicked done in dialog',
                    handler: function() {
                        if ( this._checkValues() ) {
                            var settings = this._getChoices();
                            this.fireEvent('settingsChosen', settings);
                            this.close();
                        }                       
                    }
                },
                {
                    xtype: 'component',
                    itemId: 'cancelLink',
                    renderTpl: '<a href="#" class="dialog-cancel-link">Cancel</a>',
                    renderSelectors: {
                        cancelLink: 'a'
                    },
                    listeners: {
                        click: {
                            element: 'cancelLink',
                            fn: function(){
                                this.close();
                            },
                            stopEvent: true
                        },
                        scope: this
                    }
                }
            ]
        });
    }
});
