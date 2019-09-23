'use strict';

//const Constants = require('./bme680_constants');

// Structure to hold the Calibration data
//module.exports = 
class BME680_CalibrationData {
    constructor() {
        this.par_h1 = null
        this.par_h2 = null
        this.par_h3 = null
        this.par_h4 = null
        this.par_h5 = null
        this.par_h6 = null
        this.par_h7 = null
        this.par_gh1 = null
        this.par_gh2 = null
        this.par_gh3 = null
        this.par_t1 = null
        this.par_t2 = null
        this.par_t3 = null
        this.par_p1 = null
        this.par_p2 = null
        this.par_p3 = null
        this.par_p4 = null
        this.par_p5 = null
        this.par_p6 = null
        this.par_p7 = null
        this.par_p8 = null
        this.par_p9 = null
        this.par_p10 = null
        // Variable to store t_fine size
        this.t_fine = null
        // Variable to store heater resistance range
        this.res_heat_range = null
        // Variable to store heater resistance value
        this.res_heat_val = null
        // Variable to store error range
        this.range_sw_err = null
    }


    static bytes_to_word(msb, lsb, bits = 16, signed = false) {
        let word = (msb << 8) | lsb;
        if (signed) {
            word = BME680_CalibrationData.twos_comp(word, bits);
        }
        return word;
    }

    static twos_comp(val, bits = 16) {
        bits = +bits || 32;
        if (bits > 32) throw new RangeError('uintToInt only supports ints up to 32 bits');
        val <<= 32 - bits;
        val >>= 32 - bits;
        return val;
    }

    setFromArray(calibration) {
        // Temperature related coefficients
        this.par_t1 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.T1_MSB_REG], calibration[bme680_constants.T1_LSB_REG]);
        this.par_t2 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.T2_MSB_REG], calibration[bme680_constants.T2_LSB_REG], 16, true);
        this.par_t3 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.T3_REG], 8);

        // Pressure related coefficients
        this.par_p1 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.P1_MSB_REG], calibration[bme680_constants.P1_LSB_REG]);
        this.par_p2 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.P2_MSB_REG], calibration[bme680_constants.P2_LSB_REG], 16, true);
        this.par_p3 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.P3_REG], 8);
        this.par_p4 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.P4_MSB_REG], calibration[bme680_constants.P4_LSB_REG], 16, true);
        this.par_p5 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.P5_MSB_REG], calibration[bme680_constants.P5_LSB_REG], 16, true);
        this.par_p6 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.P6_REG], 8);
        this.par_p7 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.P7_REG], 8);
        this.par_p8 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.P8_MSB_REG], calibration[bme680_constants.P8_LSB_REG], 16, true);
        this.par_p9 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.P9_MSB_REG], calibration[bme680_constants.P9_LSB_REG], 16, true);
        this.par_p10 = calibration[bme680_constants.P10_REG];

        // Humidity related coefficients
        this.par_h1 = (calibration[bme680_constants.H1_MSB_REG] << bme680_constants.HUM_REG_SHIFT_VAL) | (calibration[bme680_constants.H1_LSB_REG] & bme680_constants.BIT_H1_DATA_MSK)
        this.par_h2 = (calibration[bme680_constants.H2_MSB_REG] << bme680_constants.HUM_REG_SHIFT_VAL) | (calibration[bme680_constants.H2_LSB_REG] >> bme680_constants.HUM_REG_SHIFT_VAL)
        this.par_h3 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.H3_REG], 8)
        this.par_h4 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.H4_REG], 8)
        this.par_h5 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.H5_REG], 8)
        this.par_h6 = calibration[bme680_constants.H6_REG]
        this.par_h7 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.H7_REG], 8)

        // Gas heater related coefficients
        this.par_gh1 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.GH1_REG], 8)
        this.par_gh2 = BME680_CalibrationData.bytes_to_word(calibration[bme680_constants.GH2_MSB_REG], calibration[bme680_constants.GH2_LSB_REG], 16, true)
        this.par_gh3 = BME680_CalibrationData.twos_comp(calibration[bme680_constants.GH3_REG], 8)
    }


    setOther(heat_range, heat_value, sw_error) {
        this.res_heat_range =Math.floor( (heat_range & bme680_constants.RHRANGE_MSK) / 16);
        this.res_heat_val = heat_value;
        this.range_sw_err =Math.floor( (sw_error & bme680_constants.RSERROR_MSK) )/ 16;
    }
};
