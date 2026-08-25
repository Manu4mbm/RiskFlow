/**
 * Sample 8-activity construction project, loaded via the Activities empty state
 * or Project > Load Sample. Durations in days, costs in the project currency.
 */
(function (global) {
    'use strict';

    global.SAMPLE_PROJECT = {
        version: 1,
        name: 'Sample Project — Warehouse Build',
        currency: 'INR',
        iterations: 5000,
        distribution: 'pert',
        ganttConfidence: 'p80',
        tasks: [
            { id: 't1', name: 'Mobilization & Site Setup', deps: [], dO: 2, dM: 3, dP: 5, cO: 80000, cM: 100000, cP: 140000 },
            { id: 't2', name: 'Site Clearance & Earthwork', deps: ['t1'], dO: 4, dM: 6, dP: 10, cO: 150000, cM: 200000, cP: 280000 },
            { id: 't3', name: 'Foundation & Substructure', deps: ['t2'], dO: 8, dM: 12, dP: 18, cO: 400000, cM: 550000, cP: 750000 },
            { id: 't4', name: 'Structural Framing', deps: ['t3'], dO: 15, dM: 20, dP: 30, cO: 900000, cM: 1200000, cP: 1600000 },
            { id: 't5', name: 'Roofing & Envelope', deps: ['t4'], dO: 6, dM: 9, dP: 14, cO: 300000, cM: 400000, cP: 550000 },
            { id: 't6', name: 'MEP Rough-in', deps: ['t4'], dO: 10, dM: 14, dP: 20, cO: 500000, cM: 650000, cP: 900000 },
            { id: 't7', name: 'Interior Finishes', deps: ['t5', 't6'], dO: 12, dM: 18, dP: 26, cO: 600000, cM: 800000, cP: 1100000 },
            { id: 't8', name: 'Final Inspection & Handover', deps: ['t7'], dO: 3, dM: 5, dP: 8, cO: 60000, cM: 90000, cP: 130000 }
        ]
    };
})(window);
