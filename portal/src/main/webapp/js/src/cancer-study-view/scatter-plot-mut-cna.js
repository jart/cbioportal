/*
 * Copyright (c) 2015 Memorial Sloan-Kettering Cancer Center.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS
 * FOR A PARTICULAR PURPOSE. The software and documentation provided hereunder
 * is on an "as is" basis, and Memorial Sloan-Kettering Cancer Center has no
 * obligations to provide maintenance, support, updates, enhancements or
 * modifications. In no event shall Memorial Sloan-Kettering Cancer Center be
 * liable to any party for direct, indirect, special, incidental or
 * consequential damages, including lost profits, arising out of the use of this
 * software and its documentation, even if Memorial Sloan-Kettering Cancer
 * Center has been advised of the possibility of such damage.
 */

/*
 * This file is part of cBioPortal.
 *
 * cBioPortal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/



function plotMutVsCna(csObs,divId,caseIdDiv,cancerStudyId,dt,emphasisCaseIds,colCna,colMut,caseMap,hLog,vLog) {
        var scatterDataView = new google.visualization.DataView(dt);
        var params = [
            colCna,
            colMut,
            {
                calc:function(dt,row){
                    return dt.getValue(row,0)+'\n('+(dt.getValue(row,colCna)*100).toFixed(1)+'%, '+dt.getValue(row,colMut)+')';
                },
                type:'string',
                role:'tooltip'
            }
        ];
        var emIds = emphasisCaseIds;
        if (emIds==null) {
            if ((typeof csObs.caseId)==(typeof {})) {
                emIds = csObs.caseId;
            } else if ((typeof csObs.caseId)==(typeof '')) {
                emIds={};
                emIds[csObs.caseId]=true;
            }
        }
        if (emIds)
            params.push(
            {
                calc:function(dt,row){
                    return (dt.getValue(row,0) in emIds) ? dt.getValue(row,colMut) : null;
                },
                type:'number'
            },
            {
                calc:function(dt,row){
                    if (dt.getValue(row,0) in emIds)
                        return dt.getValue(row,0)+'\n('+(dt.getValue(row,colCna)*100).toFixed(1)+'%, '+dt.getValue(row,colMut)+')';
                    else
                        return null;
                },
                type:'string',
                role:'tooltip'
            });
        scatterDataView.setColumns(params);
        var scatter = new google.visualization.ScatterChart(document.getElementById(divId));
        
        if (csObs) {
            google.visualization.events.addListener(scatter, 'select', function(e){
                var s = scatter.getSelection();
                if (s.length>1) return;
                var caseId = s.length==0 ? null : dt.getValue(s[0].row,0);
                csObs.fireSelection(caseId, divId);
                resetSmallPlots();
            });

            google.visualization.events.addListener(scatter, 'ready', function(e){
                csObs.subscribe(divId,function(caseId) {
                    plotMutVsCna(csObs,divId,caseIdDiv,cancerStudyId,dt,emphasisCaseIds,colCna,colMut,caseMap,hLog,vLog);
                },false);
            });
        }
        
        var options = {
            hAxis: {title: "Fraction of copy number altered genome"+(hLog?" (log)":""), logScale:hLog, format:'#%'},
            vAxis: {title: "mutation count"+(vLog?" (log)":""), logScale:vLog, format:'#,###'},
            legend: {position:'none'}
        };
        scatter.draw(scatterDataView,options);
        return scatter;
}

function loadMutCountCnaFrac(caseIds,cancerStudyId,mutationProfileId,hasCnaSegmentData,func) {

    var mutDataTable = null;
    if (mutationProfileId!=null) {
        var params = {
            cmd: 'count_mutations',
            mutation_profile: mutationProfileId
        };
        if (caseIds) {
            params["case_ids"] = caseIds.join(' ')
        }

        $.post("mutations.json", 
            params,
            function(mutationCounts){
                var wrapper = new DataTableWrapper();
                wrapper.setDataMap(mutationCounts,['case_id','mutation_count']);
                mutDataTable = wrapper.dataTable;
                mergeTablesAndCallFunc(mutationProfileId,hasCnaSegmentData,
                            mutDataTable,cnaDataTable,func);
            }
            ,"json"
        );
    }


    var cnaDataTable = null;

    if (hasCnaSegmentData) {
        var params = {
            cmd: 'get_cna_fraction',
            cancer_study_id: cancerStudyId
        };
        if (caseIds) {
            params["case_ids"] = caseIds.join(' ')
        }

        $.post("cna.json", 
            params,
            function(cnaFracs){
                var wrapper = new DataTableWrapper();
                // TODO: what if no segment available
                wrapper.setDataMap(cnaFracs,['case_id','fraction_of_copy_number_altered_genome']);
                cnaDataTable = wrapper.dataTable;
                mergeTablesAndCallFunc(mutationProfileId,hasCnaSegmentData,
                            mutDataTable,cnaDataTable,func);
            }
            ,"json"
        );
    }
}

function mergeTablesAndCallFunc(mutationProfileId,hasCnaSegmentData,
        mutDataTable,cnaDataTable,func) {
    if ((mutationProfileId!=null && mutDataTable==null) ||
        (hasCnaSegmentData && cnaDataTable==null)) {
        return;
    }

    if (func) {
        func.call(window,mergeMutCnaTables(mutDataTable,cnaDataTable));
    }
}

function mergeMutCnaTables(mutDataTable,cnaDataTable) {
    if (mutDataTable==null)
        return cnaDataTable;
    if (cnaDataTable==null)
        return mutDataTable;

     return google.visualization.data.join(mutDataTable, cnaDataTable,
                'full', [[0,0]], [1],[1]);
}