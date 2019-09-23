'use strict';

//const i2c = require('i2c-bus');
//const Constants = require('./bme680_constants');
//const Bme680Data = require('./this.bme680Data');
//const CalibrationData = require('./calibrationData');
//const bme680_constants = new BME680_Constants();

//let wire;

//module.exports = 
class Bme680 {

    constructor(device, i2cAddress) {
/*
        if (typeof(device) == 'undefined') {
            device = 1;
        }
*/
       if (!i2cAddress) {
            this.i2cAddress = bme680_constants.I2C_ADDR_PRIMARY;
        } else {
            this.i2cAddress = i2cAddress
        }

        this.bme680Data = new BME680_Data();

//        wire = i2c.openSync(device);
		this.wire = device.i2c.openSync();
    }

    async  initialize() {
        this.chip_id = await this.readByte(bme680_constants.CHIP_ID_ADDR, 1);
        if (this.chip_id !== bme680_constants.CHIP_ID) {
            const invalidChipIdError = `BME680 Not Found. Invalid CHIP ID: ${this.chip_id.toString(16)}`;
            console.error(invalidChipIdError);
            throw new Error(invalidChipIdError);
        }
        this.bme680Data.chip_id = bme680_constants.CHIP_ID;
        await this.softReset();
        await this.setPowerMode(bme680_constants.SLEEP_MODE);
        await this.getCalibrationData();
        await this.setHumidityOversample(bme680_constants.OS_2X);
        await this.setPressureOversample(bme680_constants.OS_4X);
        await this.setTemperatureOversample(bme680_constants.OS_8X);
        await this.setFilter(bme680_constants.FILTER_SIZE_3);
        await this.setGasStatus(bme680_constants.ENABLE_GAS_MEAS);
        await this.setTempOffset(0);

        await this.getSensorData();

        await this.setGasHeaterTemperature(320);
        await this.setGasHeaterDuration(150);
        await this.selectGasHeaterProfile(0);
    }

    async getSensorData() {

        await this.setPowerMode(bme680_constants.FORCED_MODE);

        let i = 0, status;
        do {
            status = await this.readByte(bme680_constants.FIELD0_ADDR, 1);
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, bme680_constants.POLL_PERIOD_MS);
            });
            i++;
        }
        while (i < 1000 && !(status & bme680_constants.NEW_DATA_MSK));

        let regs = await this.readByte(bme680_constants.FIELD0_ADDR, bme680_constants.FIELD_LENGTH);

        this.bme680Data.data.status = regs[0] & bme680_constants.NEW_DATA_MSK;
        // Contains the nb_profile used to obtain the current measurement
        this.bme680Data.data.gas_index = regs[0] & bme680_constants.GAS_INDEX_MSK;
        this.bme680Data.data.meas_index = regs[1];

        const adc_pres = (regs[2] << 12) | (regs[3] << 4) | (regs[4] >> 4);
        const adc_temp = (regs[5] << 12) | (regs[6] << 4) | (regs[7] >> 4);
        const adc_hum = (regs[8] << 8) | regs[9];
        const adc_gas_res = (regs[13] << 2) | (regs[14] >> 6);
        const gas_range = regs[14] & bme680_constants.GAS_RANGE_MSK;

        this.bme680Data.data.status |= regs[14] & bme680_constants.GASM_VALID_MSK;
        this.bme680Data.data.status |= regs[14] & bme680_constants.HEAT_STAB_MSK;

        this.bme680Data.data.heat_stable = (this.bme680Data.data.status & bme680_constants.HEAT_STAB_MSK) > 0;

        let temperature = await this.calcTemperature(adc_temp);
        this.bme680Data.data.temperature = temperature / 100.0;
        this.ambient_temperature = temperature;// Saved for heater calc;
        this.bme680Data.ambient_temperature = this.ambient_temperature;

        this.bme680Data.data.pressure = await this.calcPressure(adc_pres) / 100.0;
        this.bme680Data.data.humidity = await this.calcHumidity(adc_hum) / 1000.0;
        this.bme680Data.data.gas_resistance = await this.calcGasResistance(adc_gas_res, gas_range);
        this.bme680Data.calibration_data = this.calibrationData;
        return this.bme680Data;
    }


    async setGasHeaterDuration(value, nb_profile = 0) {
        if (nb_profile > bme680_constants.NBCONV_MAX || value < bme680_constants.NBCONV_MIN) {
            throw new Error(`Profile '${nb_profile}' should be between ${bme680_constants.NBCONV_MIN} and ${bme680_constants.NBCONV_MAX}`);
        }
        this.bme680Data.gas_settings.heatr_dur = value;
        let temp = this.calcHeaterDuration(this.bme680Data.gas_settings.heatr_dur);
        await this.writeByte(bme680_constants.GAS_WAIT0_ADDR + nb_profile, temp);
    }

    async selectGasHeaterProfile(value) {
        if (value > bme680_constants.NBCONV_MAX || value < bme680_constants.NBCONV_MIN) {
            throw new Error(`Profile '${value}' should be between ${bme680_constants.NBCONV_MIN} and ${bme680_constants.NBCONV_MAX}`);
        }
        this.bme680Data.gas_settings.nb_conv = value
        await this.setBits(bme680_constants.CONF_ODR_RUN_GAS_NBC_ADDR, bme680_constants.NBCONV_MSK, bme680_constants.NBCONV_POS, value);
    }

    calcHeaterDuration(duration) {
        if (duration < 0xfc0) {
            let factor = 0

            while (duration > 0x3f) {
                duration /= 4
                factor += 1
            }

            return Number.parseInt(duration + (factor * 64));
        }
        return 0xff;
    }

    async setGasHeaterTemperature(value, nb_profile = 0) {

        if (nb_profile > bme680_constants.NBCONV_MAX || value < bme680_constants.NBCONV_MIN) {
            throw new Error(`Profile '${nb_profile}' should be between ${bme680_constants.NBCONV_MIN} and ${bme680_constants.NBCONV_MAX}`);
        }

        this.bme680Data.gas_settings.heatr_temp = value;
        let temp = Number.parseInt(this.calcHeaterResistance(this.bme680Data.gas_settings.heatr_temp));
        await this.writeByte(bme680_constants.RES_HEAT0_ADDR + nb_profile, temp);
    }

    async  calcGasResistance(gas_res_adc, gas_range) {
        let var1 = (1340.0 + (5.0 * this.calibrationData.range_sw_err));
        let var2 = (var1) * (1.0 + bme680_constants.lookupTable1[gas_range] / 100.0);
        let var3 = 1.0 + (bme680_constants.lookupTable2[gas_range] / 100.0);
        return 1.0 / (var3 * (0.000000125) * (1 << gas_range) * ((((gas_res_adc) - 512.0) / var2) + 1.0));
    }

    calcHeaterResistance(temperature) {
        temperature = Math.min(Math.max(temperature, 200), 400);
        let var1 = ((this.ambient_temperature * this.calibrationData.par_gh3) / 1000) * 256;
        let var2 = (this.calibrationData.par_gh1 + 784) * (((((this.calibrationData.par_gh2 + 154009) * temperature * 5) / 100) + 3276800) / 10);
        let var3 = var1 + (var2 / 2);
        let var4 = (var3 / (this.calibrationData.res_heat_range + 4));
        let var5 = (131 * this.calibrationData.res_heat_val) + 65536;
        let heatr_res_x100 = (((var4 / var5) - 250) * 34);
        return (heatr_res_x100 + 50) / 100;
    }

    async calcHumidity(humidity_adc) {
        let temp_scaled = ((this.calibrationData.t_fine * 5) + 128) >> 8;
        let var1 = (humidity_adc - this.calibrationData.par_h1 * 16) - (Math.floor((temp_scaled * this.calibrationData.par_h3) / (100)) >> 1);
        let var2 = (this.calibrationData.par_h2 * (Math.floor((temp_scaled * this.calibrationData.par_h4) / (100))
            + Math.floor(((temp_scaled * Math.floor((temp_scaled * this.calibrationData.par_h5) / (100))) >> 6) / (100)) + (1 * 16384))) >> 10
        let var3 = var1 * var2
        let var4 = this.calibrationData.par_h6 << 7
        var4 = Math.floor((var4) + ((temp_scaled * this.calibrationData.par_h7) / (100))) >> 4
        let var5 = ((var3 >> 14) * (var3 >> 14)) >> 10
        let var6 = (var4 * var5) >> 1
        let calc_hum = (((var3 + var6) >> 10) * (1000)) >> 12

        return Math.min(Math.max(calc_hum, 0), 100000)
    }

    async calcPressure(pressure_adc) {
        let var1 = ((this.calibrationData.t_fine) >> 1) - 64000;
        let var2 = ((((var1 >> 2) * (var1 >> 2)) >> 11) * this.calibrationData.par_p6) >> 2;
        var2 = var2 + ((var1 * this.calibrationData.par_p5) << 1);
        var2 = (var2 >> 2) + (this.calibrationData.par_p4 << 16);
        var1 = (((((var1 >> 2) * (var1 >> 2)) >> 13) *
            (this.calibrationData.par_p3 << 5) >> 3) +
            ((this.calibrationData.par_p2 * var1) >> 1));
        var1 = var1 >> 18;

        var1 = ((32768 + var1) * this.calibrationData.par_p1) >> 15;
        let calc_pressure = 1048576 - pressure_adc;
        calc_pressure = ((calc_pressure - (var2 >> 12)) * (3125));

        if (calc_pressure >= (1 << 31)) {
            calc_pressure = (Math.floor(calc_pressure / var1) << 1);
        }
        else {
            calc_pressure = Math.floor((calc_pressure << 1) / var1);
        }

        var1 = (this.calibrationData.par_p9 * (((calc_pressure >> 3) * (calc_pressure >> 3)) >> 13)) >> 12;
        var2 = ((calc_pressure >> 2) * this.calibrationData.par_p8) >> 13;

        let var3 = ((calc_pressure >> 8) * (calc_pressure >> 8) * (calc_pressure >> 8) * this.calibrationData.par_p10) >> 17;

        calc_pressure = (calc_pressure) + ((var1 + var2 + var3 + (this.calibrationData.par_p7 << 7)) >> 4);

        return calc_pressure;
    }

    async calcTemperature(temperature_adc) {
        const var1 = (temperature_adc >> 3) - (this.calibrationData.par_t1 << 1);
        const var2 = (var1 * this.calibrationData.par_t2) >> 11;
        let var3 = ((var1 >> 1) * (var1 >> 1)) >> 12;
        var3 = ((var3) * (this.calibrationData.par_t3 << 4)) >> 14;

        // Save teperature data for pressure calculations
        this.calibrationData.t_fine = (var2 + var3) + this.offset_temp_in_t_fine;
        return ((this.calibrationData.t_fine * 5) + 128) >> 8;
    }

    setTempOffset(value) {
        if (value === 0) {
            this.offset_temp_in_t_fine = 0;
        }
        else {
            this.offset_temp_in_t_fine = parseInt((((parseInt(Math.abs(value) * 100)) << 8) - 128) / 5);
            if (value < 0) {
                this.offset_temp_in_t_fine = - this.offset_temp_in_t_fine;
            }
        }
    }

    async setGasStatus(value) {
        this.bme680Data.gas_settings.run_gas = value
        await this.setBits(bme680_constants.CONF_ODR_RUN_GAS_NBC_ADDR, bme680_constants.RUN_GAS_MSK, bme680_constants.RUN_GAS_POS, value);
    }

    async setFilter(value) {
        this.bme680Data.tph_settings.filter = value
        await this.setBits(bme680_constants.CONF_ODR_FILT_ADDR, bme680_constants.FILTER_MSK, bme680_constants.FILTER_POS, value)
    }

    async setHumidityOversample(value) {
        this.bme680Data.tph_settings.os_hum = value;
        await this.setBits(bme680_constants.CONF_OS_H_ADDR, bme680_constants.OSH_MSK, bme680_constants.OSH_POS, value);
    }

    async setPressureOversample(value) {
        this.bme680Data.tph_settings.os_pres = value
        await this.setBits(bme680_constants.CONF_T_P_MODE_ADDR, bme680_constants.OSP_MSK, bme680_constants.OSP_POS, value);
    }

    async setTemperatureOversample(value) {
        this.bme680Data.tph_settings.os_temp = value
        await this.setBits(bme680_constants.CONF_T_P_MODE_ADDR, bme680_constants.OST_MSK, bme680_constants.OST_POS, value);
    }

    async getTemperatureOversample() {
        return await this.readByte(bme680_constants.CONF_T_P_MODE_ADDR);
    }

    /**
     * Retrieves the sensor calibration data and stores it in .calibration_data
     */
    async getCalibrationData() {
        this.calibrationData = new BME680_CalibrationData();

//        let calibration = Buffer.concat(
//            [await this.readByte(bme680_constants.COEFF_ADDR1, bme680_constants.COEFF_ADDR1_LEN),
//            await this.readByte(bme680_constants.COEFF_ADDR2, bme680_constants.COEFF_ADDR2_LEN)]
//        );
        var array_base = await this.readByte(bme680_constants.COEFF_ADDR1, bme680_constants.COEFF_ADDR1_LEN);
        var array_add = await this.readByte(bme680_constants.COEFF_ADDR2, bme680_constants.COEFF_ADDR2_LEN);
        let calibration = array_base.concat(array_add);
        
        let heat_range = await this.readByte(bme680_constants.ADDR_RES_HEAT_RANGE_ADDR, 1);
        let heat_value = BME680_CalibrationData.twos_comp(await this.readByte(bme680_constants.ADDR_RES_HEAT_VAL_ADDR, 1), 8);
        let sw_error = BME680_CalibrationData.twos_comp(await this.readByte(bme680_constants.ADDR_RANGE_SW_ERR_ADDR, 1), 8);

        this.calibrationData.setFromArray(calibration);
        this.calibrationData.setOther(heat_range, heat_value, sw_error);
    }

    /**
     * Initiate a soft reset
     */
    async	softReset() {
        await this.writeByte(bme680_constants.SOFT_RESET_ADDR, bme680_constants.SOFT_RESET_CMD)
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, bme680_constants.RESET_PERIOD);
        });
    }

    /**
     * Get power mode
     */
    async getPowerMode() {
        return await this.readByte(bme680_constants.CONF_T_P_MODE_ADDR, 1);
    }

    /**
     * Set power mode
     * @param {*} value
     * @param {*} blocking
     */
    async setPowerMode(value, blocking = false, maxPollTimeMs = null) {
        if (value !== bme680_constants.SLEEP_MODE && value !== bme680_constants.FORCED_MODE) {
            throw new Error("Power mode should be one of SLEEP_MODE or FORCED_MODE");
        }

        if (!maxPollTimeMs) {
            maxPollTimeMs = 10000 * bme680_constants.POLL_PERIOD_MS;
        }

        this.power_mode = value;
        this.bme680Data.power_mode = this.power_mode;
        await this.setBits(bme680_constants.CONF_T_P_MODE_ADDR, bme680_constants.MODE_MSK, bme680_constants.MODE_POS, value);
        return new Promise((resolve, reject) => {
            let cpt = 0;
            const intervalPowerModeSwitch = setInterval(async () => {
                const currentPowerMode = await this.getPowerMode();
                if (!blocking || currentPowerMode === this.power_mode) {
                    clearInterval(intervalPowerModeSwitch);
                    resolve(this.power_mode);
                }
                cpt++;
                if (cpt * bme680_constants.POLL_PERIOD_MS >= maxPollTimeMs) {
                    clearInterval(intervalPowerModeSwitch);
                    reject(new Error(`Power mode could not be updated after a delay of ${cpt * bme680_constants.POLL_PERIOD_MS} ms`));
                }
            }, bme680_constants.POLL_PERIOD_MS);
        });
    }

    async  writeByte(cmd, byte) {
        return new Promise((resolve, reject) => {
            this.wire.writeByte(this.i2cAddress, cmd, byte, function (err, data) {
                if (err) {
                    reject(err);
                }
                resolve(data);
            });
        });
    }

    async  readByte(cmd, length) {
        return new Promise((resolve, reject) => {
            if (!length || length === 1) {
                this.wire.readByte(this.i2cAddress, cmd, (err, config) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(config);
                });
            }
            else {
//                let buffer = Buffer.alloc(length);
                let buffer = new Array(length);
                this.wire.readI2cBlock(this.i2cAddress, cmd, length, buffer, (err, config) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(buffer);
                });
            }

        });
    }

    async setBits(register, mask, position, value) {
        let temp = await this.readByte(register, 1);
        temp &= ~mask;
        temp |= value << position;
        await this.writeByte(register, temp);
    }
}
