//These strings are important! dont F$©k around with it! You better know what the hell you're doing if you decide to change something here!
//These strings are important! dont F$©k around with it! You better know what the hell you're doing if you decide to change something here!
//These strings are important! dont F$©k around with it! You better know what the hell you're doing if you decide to change something here!


//WARNING: This is a string. leave it as a string
export const AGG_QUERY_NETCLASS_STATS = `[
    {
        "$match": { "projectId": "####_PROJECTID_####" }
    },
    {
        "$group": {
            "_id": "$netclassId",
            "autoAssignedCount": {
                "$sum": { "$cond": [{ "$eq": ["$netclassMapType", "Auto"] }, 1, 0] }
            },
            "manualAssignedCount": {
                "$sum": { "$cond": [{ "$eq": ["$netclassMapType", "Manual"] }, 1, 0] }
            }
        }
    }
]`



//WARNING: This is an object (NOT a string) - leave it as such 
export const AGG_QUERY_DIFF_PAIR_FORMATION = [
    {
        "$match": {
            "$and": [
                {
                    "projectId": "####_PROJECTID_####"
                },
                {
                    "diffPairMapType": { "$regex": "####_DIFFPAIR_MAP_TYPE_####", "$options": "i" }
                },
                {
                    "name": { "$regex": "^(?!(####_STARTSWITH_####)).*$", "$options": "i" }
                },
                {
                    "name": { "$regex": "^(?!.*(####_CONTAINS_####)).+$", "$options": "i" }
                },
                {
                    "name": { "$regex": "^(?!.*(####_ENDSWITH_####)$).*", "$options": "i" }
                },
                {
                    "name": { "$regex": "(.*[####_TOKEN_CLASS_####](.*))", "$options": "i" }
                }
            ]
        }
    },
    {
        "$addFields": {
            "potentialDiff": {
                "$replaceAll": {
                    "input": "$name",
                    "find": "####_TOKEN_ONE_####",
                    "replacement": "####_TOKEN_TWO_####"
                }
            }
        }
    },
    {
        "$project": {
            "name": 1,
            "potentialDiff": 1,
            "diffPairNet": 1,
            "diffPairMapType": 1,
            "matchField": {
                "$cond": {
                    "if": {
                        "$eq": [
                            "$name",
                            "$potentialDiff"
                        ]
                    },
                    "then": "$name",
                    "else": "$potentialDiff"
                }
            }
        }
    },
    {
        "$group": {
            "_id": "$matchField",
            "count": {
                "$sum": 1
            },
            "items": {
                "$push": "$$ROOT"
            }
        }
    },
    {
        "$match": {
            "count": {
                "$eq": 2
            }
        }
    }
]




//=======================================================================================================================

//No longer used.... a different method of queerying (non aggregation) was used
// export const AGG_QUERY_C2CROW_RETRIEVAL = `[
//     {
//       "$match": {
//         "projectId": { "$eq": "####_PROJECTID_####" },
//         "ruleAreaId": { "$regex": "####_RULEAREAID_####", "$options": "i" },
//         "netclassId": { "$regex": "####_NETCLASSID_####", "$options": "i" },
//         "netclassId": ####_NETCLASSID_IN_FILTER_####
//       }
//     },
//     {
//       "$lookup": {
//         "from": "Netclass",
//         "let": { "ncIdStr": { "$toString": "$netclassId" } },
//         "pipeline": [
//           {
//             "$match": {
//               "$expr": {
//                 "$eq": [{ "$toString": "$_id" }, "$$ncIdStr"]
//               }
//             }
//           }
//         ],
//         "as": "netclassDetails"
//       }
//     },
//     {
//       "$unwind": "$netclassDetails"
//     },
//     {
//       "$addFields": {
//         "name": "$netclassDetails.name"
//       }
//     },
//     {
//       "$match": {
//         "$and": [
//             {"name": { "$gt": "####_NC_NAME_LAST_ITEM_MARKER_####" }},
//             {"name": { "$regex": "####_STARTSWITH_####", "$options": "i" }}
//         ]
//       }
//     },
//     {
//       "$sort": { "name": 1, "_id": 1 }
//     },
//     {
//       "$limit": ####_LIMIT_####
//     },
//     {
//       "$project": {
//         "netclassDetails": 0
//       }
//     }
// ]`
//-------------------------------------------------------  


// before change of starts with to allow user to search with regex-like string
// export const AGG_QUERY_C2CROW_RETRIEVAL = `[
//     {
//       "$match": {
//         "projectId": { "$eq": "####_PROJECTID_####" },
//         "ruleAreaId": { "$regex": "####_RULEAREAID_####", "$options": "i" },
//         "netclassId": { "$regex": "####_NETCLASSID_####", "$options": "i" },
//         "netclassId": ####_NETCLASSID_IN_FILTER_####
//       }
//     },
//     {
//       "$lookup": {
//         "from": "Netclass",
//         "let": { "ncIdStr": { "$toString": "$netclassId" } },
//         "pipeline": [
//           {
//             "$match": {
//               "$expr": {
//                 "$eq": [{ "$toString": "$_id" }, "$$ncIdStr"]
//               }
//             }
//           }
//         ],
//         "as": "netclassDetails"
//       }
//     },
//     {
//       "$unwind": "$netclassDetails"
//     },
//     {
//       "$addFields": {
//         "name": "$netclassDetails.name"
//       }
//     },
//     {
//       "$match": {
//         "$and": [
//             {"name": { "$gt": "####_NC_NAME_LAST_ITEM_MARKER_####" }},
//             {"name": { "$regex": "^####_STARTSWITH_####", "$options": "i" }}
//         ]
//       }
//     },
//     {
//       "$sort": { "name": 1, "_id": 1 }
//     },
//     {
//       "$limit": ####_LIMIT_####
//     },
//     {
//       "$project": {
//         "netclassDetails": 0
//       }
//     }
// ]`
  
  


// export const AGG_QUERY_C2CROW_RETRIEVAL = `[
//     {
//       "$match": {
//         "projectId": { "$eq": "####_PROJECTID_####" },
//         "ruleAreaId": { "$regex": "####_RULEAREAID_####", "$options": "i" },
//         "netclassId": { "$regex": "####_NETCLASSID_####", "$options": "i" }
//       }
//     },
//     {
//       "$lookup": {
//         "from": "Netclass",
//         "let": { "ncIdStr": { "$toString": "$netclassId" } },
//         "pipeline": [
//           {
//             "$match": {
//               "$expr": {
//                 "$eq": [{ "$toString": "$_id" }, "$$ncIdStr"]
//               }
//             }
//           }
//         ],
//         "as": "netclassDetails"
//       }
//     },
//     {
//       "$unwind": "$netclassDetails"
//     },
//     {
//       "$addFields": {
//         "name": "$netclassDetails.name"
//       }
//     },
//     {
//       "$match": {
//         "$and": [
//             {"name": { "$gt": "####_NC_NAME_LAST_ITEM_MARKER_####" }},
//             {"name": { "$regex": "^####_STARTSWITH_####", "$options": "i" }}
//         ]
//       }
//     },
//     {
//       "$sort": { "name": 1, "_id": 1 }
//     },
//     {
//       "$limit": ####_LIMIT_####
//     },
//     {
//       "$project": {
//         "netclassDetails": 0
//       }
//     }
// ]`



//==========================================================================================================
//----------- LEAVE THIS HERE for notes -- previously configured 'diff_pair_formation_aggregation' ---------
//==========================================================================================================
// [
//     {
//         "$match": {
//             "$and": [
//                 {
//                     "projectId": "####_PROJECTID_####"
//                 },
//                 {
//                     "name": {
//                         "$regex": "^(?!(####_STARTSWITH_####))\\w+$",
//                         "$options": "i"
//                     }
//                 },
//                 {
//                     "name": {
//                         "$regex": "^(?!.*(####_ENDSWITH_####)$).*",
//                         "$options": "i"
//                     }
//                 },
//                 {
//                     "name": {
//                         "$regex": "^(?!.*(####_CONTAINS_####)).+$",
//                         "$options": "i"
//                     }
//                 },
//                 {
//                     "name": {
//                         "$regex": "(.*[PNpn].*)",
//                         "$options": "i"
//                     }
//                 }
//             ]
//         }
//     },
//     {
//         "$addFields": {
//             "potentialDiff": {
//                 "$replaceAll": {
//                     "input": "$name",
//                     "find": "P",
//                     "replacement": "N"
//                 }
//             }
//         }
//     },
//     {
//         "$project": {
//             "name": 1,
//             "potentialDiff": 1,
//             "diffPairNet": 1,
//             "diffPairMapType": 1,
//             "matchField": {
//                 "$cond": {
//                     "if": {
//                         "$eq": [
//                             "$name",
//                             "$potentialDiff"
//                         ]
//                     },
//                     "then": "$name",
//                     "else": "$potentialDiff"
//                 }
//             }
//         }
//     },
//     {
//         "$group": {
//             "_id": "$matchField",
//             "count": {
//                 "$sum": 1
//             },
//             "items": {
//                 "$push": "$$ROOT"
//             }
//         }
//     },
//     {
//         "$match": {
//             "count": {
//                 "$eq": 2
//             }
//         }
//     }
// ]

//==========================================================================================================
//==========================================================================================================