'use strict';

//const FieldData = require('./fieldData');
//const CalibrationData = require('./calibrationData');
//const TPHSettings = require('./tphSettings');
//const GasSettings = require('./gasSettings');

// BME680 device structure

//module.exports = 
class BME680_Data{
constructor(){
    // Chip Id
    this.chip_id = null;
    // Device Id
    this.dev_id = null;
    // SPI/I2C interface
    this.intf = null;
    // Memory page used
    this.mem_page = null;
    // Ambient temperature in Degree C
    this.ambient_temperature = null;
    // Field Data
    this.data =new BME680_FieldData();
    // Sensor calibration data
    this.calibration_data = new BME680_CalibrationData();
    // Sensor settings
    this.tph_settings =new BME680_TPHSettings();
    // Gas Sensor settings
    this.gas_settings =new BME680_GasSettings();
    // Sensor power modes
    this.power_mode = null;
    // New sensor fields
    this.new_fields = null;
}};
