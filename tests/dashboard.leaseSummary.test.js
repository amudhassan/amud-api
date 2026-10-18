jest.mock('../config/db',()=>({query:jest.fn(async()=>({rows:[]}))}));
jest.mock('../services/reports/reportAccessService',()=>({REPORT_PERMISSION_MODES:{FINANCIAL:'finance',MANAGEMENT:'manage'},resolveReportScope:jest.fn(async()=>({owner_ids:null}))}));
jest.mock('../services/reports/occupancyLeaseReportService',()=>({getOccupancyReport:jest.fn(),getExpiringLeasesReport:jest.fn(),getLeaseReport:jest.fn()}));
jest.mock('../services/reports/financialReportService',()=>({getFinancialSummary:jest.fn(async()=>({report:{currencies:[]}}))}));
jest.mock('../services/reports/maintenanceReportService',()=>({getMaintenanceSummary:jest.fn(async()=>({report:{summary:{}}}))}));
const reports=require('../services/reports/occupancyLeaseReportService');
const {getDashboard}=require('../services/reports/dashboardService');
beforeEach(()=>{
 reports.getOccupancyReport.mockResolvedValue({report:{summary:{total_units:62}}});
 reports.getExpiringLeasesReport.mockResolvedValue({report:{expiring_count:0,leases:[]}});
 reports.getLeaseReport.mockResolvedValue({report:{summary:{active_leases:22,expired_leases:32,expiring_30_days:0},leases:[]}});
});
test('ended lease totals remain visible even when no leases are expiring soon',async()=>{
 const filters={owner_public_id:'owner_demo',property_public_id:'property_demo'};
 const authenticatedUser={id:1,role:'admin'};
 const {dashboard}=await getDashboard({filters,authenticatedUser});
 expect(dashboard.lease_summary.expired_leases).toBe(32);
 expect(dashboard.expiring_leases_30_days.count).toBe(0);
 expect(dashboard.expired_leases.count).toBe(32);
 expect(reports.getLeaseReport).toHaveBeenCalledWith({filters:{...filters,status:'expired',limit:10},authenticatedUser});
 expect(reports.getLeaseReport).toHaveBeenCalledWith({filters:{...filters,limit:1},authenticatedUser});
});
test('does not expose lease summary without portfolio permission',async()=>{
 reports.getOccupancyReport.mockResolvedValue({forbidden:true});
 const {dashboard}=await getDashboard({filters:{},authenticatedUser:{id:2,role:'user'}});
 expect(dashboard.lease_summary).toBeNull();
});
test('does not expose a separately denied lease report',async()=>{
 reports.getLeaseReport.mockResolvedValue({forbidden:true});
 const {dashboard}=await getDashboard({filters:{},authenticatedUser:{id:2,role:'user'}});
 expect(dashboard.lease_summary).toBeNull();
});
