import { DBCollectionTypeEnum, ConstraintChangeActionEnum, NamingContentTypeEnum } from "../Models/Constants";
import { PackageLayout, RuleArea } from "../Models/ServiceModels";
import { ServiceModelRepository } from "../Repository/ServiceModelRepository";
import { pushDefaultConstraints } from "./DefaultConstraintsLogic";
import { performConstraintsAssessmentForRuleAreaAction } from "./ConstraintsMgmtLogic";
import { checkDuplicatesIgnoreCase, isNotNullOrEmptyOrWS, verifyNaming } from "./UtilFunctions";
import { processLinkageDeletion } from "./ProjectLogic";




export async function processRuleAreaChanges(inputPkg: PackageLayout) : Promise<PackageLayout> {
    let pkgRepo = new ServiceModelRepository<PackageLayout>(DBCollectionTypeEnum.PACKAGE_LAYOUT_COLLECTION)
    let existingPkg = await pkgRepo.GetOneByProjectID(inputPkg.projectId)
    if(!existingPkg) {
        throw new Error("Cannot update rule areas. Layout container is expected to exist but was not found for the project")
    }

    let added : RuleArea[] = inputPkg.ruleAreas.filter(a => ((!a.id) || (a.id.trim().length === 0)))
    let deleted : RuleArea[] = existingPkg.ruleAreas.filter(a => inputPkg.ruleAreas.every(x => x.id !== a.id))
    let updated : RuleArea[] = inputPkg.ruleAreas.filter(a => a.id && (a.id.length > 0) && existingPkg.ruleAreas.some(x => x.id === a.id))
    
    let modPkg = {...existingPkg}

    let namesForAdd = added?.map(a => a.ruleAreaName) ?? []
    let namesForUpdate = updated?.map(a => a.ruleAreaName) ?? []

    if(added && added.length > 0) {
        //check if there are duplicate names
        let duplCheckRes = checkDuplicatesIgnoreCase([...namesForAdd, ...namesForUpdate])
        if(duplCheckRes === false) {
            throw new Error(`Duplicate rules area names will occur. Request to add rule areas cannot be processed.`)
        }

        //check name validity
        verifyNaming(namesForAdd, NamingContentTypeEnum.RULE_AREA) 

        //ensure xmods are selected
        if(added.some(a => (isNotNullOrEmptyOrWS(a.xmodName) === false))) {
            throw new Error(`New rule area must have valid xmod selection`)
        }
        
        for(let i = 0; i < added.length; i++) {
            added[i].id = crypto.randomUUID()
            modPkg.ruleAreas.push(added[i])
        }
    }

    if(updated && updated.length > 0) {
        //check if there are duplicate names
        let duplCheckRes = checkDuplicatesIgnoreCase([...namesForUpdate, ...namesForAdd])
        if(duplCheckRes === false) {
            throw new Error(`Duplicate rules area names will occur. Request to update rule areas cannot be processed.`)
        }

        //check name validity
        verifyNaming(namesForUpdate, NamingContentTypeEnum.RULE_AREA) 

        //ensure xmods are selected
        if(updated.some(a => (isNotNullOrEmptyOrWS(a.xmodName) === false))) {
            throw new Error(`Rule area must have valid xmod selection`)
        }

        for(let i = 0; i < updated.length; i++) {
            for(let x = 0; x < modPkg.ruleAreas.length; x++) {
                if(modPkg.ruleAreas[x].id === updated[i].id) {
                    modPkg.ruleAreas[x] = updated[i]
                    break;
                }
            }
        }
    }

    if(deleted && deleted.length > 0) {
        if(deleted.some(a => (isNotNullOrEmptyOrWS(a.id) === false))) {
            throw new Error(`Rule area intended for deletion is invalid. It should have a valid identifier`)
        }

        let deletionIDs = deleted.map(a => a.id) ?? []
        modPkg.ruleAreas = modPkg.ruleAreas.filter(a => (deletionIDs.includes(a.id) === false))
    }

    let result = await pkgRepo.ReplaceOne(modPkg)
    if(result) {
        let finalPkg = await pkgRepo.GetOneByProjectID(modPkg.projectId)
        if(finalPkg) {
            let postUpdateDeletedRAs = deleted.filter(a => finalPkg.ruleAreas.every(x => x.id !== a.id)) //just defensive programming
            if(postUpdateDeletedRAs && postUpdateDeletedRAs.length > 0) {
                await performConstraintsAssessmentForRuleAreaAction(modPkg.projectId, ConstraintChangeActionEnum.RULEAREA_REMOVAL, postUpdateDeletedRAs)
                processLinkageDeletion(modPkg.projectId, [], postUpdateDeletedRAs, new Set<string>())
            }

            let postUpdateAddedRAs = finalPkg.ruleAreas.filter(a => (added && added.some(x => x.id === a.id))) //just defensive programming
            if(postUpdateAddedRAs && postUpdateAddedRAs.length > 0) {
                await performConstraintsAssessmentForRuleAreaAction(modPkg.projectId, ConstraintChangeActionEnum.RULEAREA_ADDITION, postUpdateAddedRAs)
            }

            await pushDefaultConstraints(finalPkg.projectId) 

            return finalPkg;
        }
        else {
            throw new Error("Error occured while performing update. Failed to retrieve updated layout with rule area changes")
        }
    }
    else {
        throw new Error("Unknown error occured while persisting rule area changes")
    }

}