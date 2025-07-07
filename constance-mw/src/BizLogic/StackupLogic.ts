import { StackupConstants, StackupLayerTypeEnum, StackupModelTypeEnum, StackupSideEnum } from "../Models/Constants";
import { StackupGenInfo, StackupLayer } from "../Models/ServiceModels";


interface StackupThickness {
    buildupMetal: number;
    coreMetal: number;
    dielectric: number;
    coreDielectric: number;
    core: number;
    sR: number;
}

interface StackupMaterial {
    dielectric: string;
    core: string;
    sR: string;
}

interface BaseStackupInfo {
    dielectricThickness: number;
    dielectricMaterial: string;
    buildupMetalThickness: number;
}

interface CorelessStackupInfo extends BaseStackupInfo {
    numOfLayers: number;
    bsrLayerPresent: boolean;
}

interface StdCoreStackupInfo extends BaseStackupInfo {
    numOfFrontSideMetalLayers: number;
    numOfFrontCoreMetalLayers: number;
    numOfBackSideMetalLayers: number;
    numOfBackCoreMetalLayers: number;
    coreThickness: number;
    coreMaterial: string;
    dielectricOnCoreThickness: number;
    coreMetalThickness: number;
    isEmib: boolean;
}



export async function createStackup(stackupGenInfo: StackupGenInfo): Promise<StackupLayer[]> {
    let layers = new Array<StackupLayer>();
    let stdCoreInfo = {
        numOfFrontSideMetalLayers: stackupGenInfo.frontSideMetalLayers,
        numOfFrontCoreMetalLayers: stackupGenInfo.frontCoreMetalLayers,
        numOfBackSideMetalLayers: stackupGenInfo.backSideMetalLayers,
        numOfBackCoreMetalLayers: stackupGenInfo.backCoreMetalLayers,
        coreThickness: stackupGenInfo.coreThickness,
        coreMaterial: stackupGenInfo.coreMaterial,
        dielectricOnCoreThickness: stackupGenInfo.dielectricOnCoreThickness,
        coreMetalThickness: stackupGenInfo.coreMetalThickness,
        isEmib: stackupGenInfo.isEmib,
        dielectricThickness: stackupGenInfo.dielectricThickness,
        dielectricMaterial: stackupGenInfo.dielectricMaterial,
        buildupMetalThickness: stackupGenInfo.buildupMetalThickness,
    } as StdCoreStackupInfo
    
    let corelessInfo = {
        numOfLayers: stackupGenInfo.corelessLayers,
        bsrLayerPresent: stackupGenInfo.isBSRLayer,
        dielectricThickness: stackupGenInfo.corelessDielectricThickness,
        dielectricMaterial: stackupGenInfo.corelessDielectricMaterial,
        buildupMetalThickness: stackupGenInfo.corelessBuildupMetalThickness,
    } as CorelessStackupInfo


    if(stackupGenInfo.type.toLowerCase() === StackupModelTypeEnum.StandardCore.toLowerCase()){
        layers = StdCoreStackupBL.CreateStdCoreLayersFromForm(stdCoreInfo, stackupGenInfo.solderResistMaterial, stackupGenInfo.solderResistThickness)
    }
    else if (stackupGenInfo.type.toLowerCase() === StackupModelTypeEnum.GlassCore.toLowerCase()) {
        layers = StdCoreStackupBL.CreateGlassCoreLayersFromForm(stdCoreInfo, stackupGenInfo.solderResistMaterial, stackupGenInfo.solderResistThickness)
    }
    else if (stackupGenInfo.type.toLowerCase() === StackupModelTypeEnum.Coreless.toLowerCase()) {
        layers = CorelessStackupBL.CreateCorelessLayersFromForm(stackupGenInfo.technology, corelessInfo, stackupGenInfo.solderResistMaterial, stackupGenInfo.solderResistThickness)
    }
    
    else if (stackupGenInfo.type.toLowerCase() === StackupModelTypeEnum.FullStack.toLowerCase()) {
        layers = FullStackBL.CreateFullStackLayersFromForm(stackupGenInfo.technology, stdCoreInfo, corelessInfo, stackupGenInfo.solderResistMaterial, stackupGenInfo.solderResistThickness);
    }

    for(let x = 0; x < layers.length; x++) {
        layers[x].index = x
    }

    return layers
}



class StdCoreStackupBL
{
    public static CreateStdCoreLayersFromForm(stdCoreInfo: StdCoreStackupInfo, solderResistMaterial: string, solderResistThickness: number) : Array<StackupLayer>
    {
        this.ValidateForm(stdCoreInfo, solderResistThickness);

        let layers = new Array<StackupLayer>();

        if (!stdCoreInfo) { return layers; }

        let stackupThickness: StackupThickness = {          
            buildupMetal : stdCoreInfo.buildupMetalThickness,
            dielectric : stdCoreInfo.dielectricThickness,
            coreDielectric : stdCoreInfo.dielectricOnCoreThickness,
            coreMetal : stdCoreInfo.coreMetalThickness,
            core : stdCoreInfo.coreThickness,
            sR : solderResistThickness   
        }
        
        let stackupMaterial: StackupMaterial = {
            core : stdCoreInfo.coreMaterial,
            sR : solderResistMaterial,
            dielectric : stdCoreInfo.dielectricMaterial
        }

        let flayers = this.GetFrontLayers(stackupThickness, stackupMaterial, stdCoreInfo);
        for(let i = 0; i < flayers.length; i++) {
            layers.push(flayers[i])
        }
        
        let pthlayer : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.PTH,
            thickness: stackupThickness.core as number,
            type: StackupLayerTypeEnum.PTH.toString(),
            side: StackupSideEnum.Other,
            routingLayerType: "",
            material: stackupMaterial.core,
            tags: []
        }
        layers.push(pthlayer)
        
        let blayers = this.GetBackLayers(stackupThickness, stackupMaterial, stdCoreInfo);
        for(let x = 0; x < blayers.length; x++) {
            layers.push(blayers[x])
        }
        
        return layers;
    }

    public static CreateGlassCoreLayersFromForm(stdCoreInfo: StdCoreStackupInfo, solderResistMaterial: string, solderResistThickness: number) : Array<StackupLayer> {
        this.ValidateForm(stdCoreInfo, solderResistThickness);
    
        let layers = new Array<StackupLayer>();
        let stackupThickness: StackupThickness = {          
            buildupMetal : stdCoreInfo.buildupMetalThickness,
            dielectric : stdCoreInfo.dielectricThickness,
            coreDielectric : stdCoreInfo.dielectricOnCoreThickness,
            coreMetal : stdCoreInfo.coreMetalThickness,
            core : stdCoreInfo.coreThickness,
            sR : solderResistThickness   
        }
        
        let stackupMaterial: StackupMaterial = {
            core : stdCoreInfo.coreMaterial,
            sR : solderResistMaterial,
            dielectric : stdCoreInfo.dielectricMaterial
        }

        let frontLayers = this.GetFrontLayers(stackupThickness, stackupMaterial, stdCoreInfo, true);
        let backLayers = this.GetBackLayers(stackupThickness, stackupMaterial, stdCoreInfo, true);
        let layerCntFront = frontLayers.length;
        let layerCntBack = backLayers.length;
        
        let firstFrontLayerName = frontLayers!.at(frontLayers.length-1)?.name!.split("CO")?.at(0); // this should be 1F for most part.
        let firstbackLayerName = backLayers!.at(0)?.name!.split("CO")?.at(0); // this should be 1F for most part.

        frontLayers[layerCntFront - 1].name = firstFrontLayerName || '';
        backLayers[0].name = firstbackLayerName || '';
    
        let pthLayers = new Array<StackupLayer>();
        
        let gf1 : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: `LRT_FCO-${firstFrontLayerName}`,
            type: StackupLayerTypeEnum.Dielectric.toString(),
            side: StackupSideEnum.Front,
            thickness: stackupThickness.core as number,
            material: stackupMaterial.core,
            routingLayerType: "",
            tags: []
        }
        pthLayers.push(gf1)

        let glassCoreFrontSizeLayer : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: `LRT_FCO`,
            type: StackupLayerTypeEnum.Metal.toString(),
            side: StackupSideEnum.Front,
            thickness: stackupThickness.core as number,
            material: stackupMaterial.core,
            routingLayerType: "",
            tags: []
        }
        pthLayers.push(glassCoreFrontSizeLayer)
        
        let pthCoreLayer : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.PTH,
            type: StackupLayerTypeEnum.PTH.toString(),
            side: StackupSideEnum.Other,
            thickness: stackupThickness.core as number,
            material: stackupMaterial.core,
            routingLayerType: "",
            tags: []
        }
        pthLayers.push(pthCoreLayer)
        
        let glassCorebackSizeLayer : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: `LRT_BCO`,
            type: StackupLayerTypeEnum.Metal.toString(),
            side: StackupSideEnum.Back,
            thickness: stackupThickness.core as number,
            material: stackupMaterial.core,
            routingLayerType: "",
            tags: []
        }
        pthLayers.push(glassCorebackSizeLayer)

        let gb1 : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: `LRT_BCO-${firstbackLayerName}`,
            type: StackupLayerTypeEnum.Dielectric.toString(),
            side: StackupSideEnum.Back,
            thickness: stackupThickness.core as number,
            material: stackupMaterial.core,
            routingLayerType: "",
            tags: []
        }
        pthLayers.push(gb1)
        
        for(let x = 0; x < frontLayers.length; x++) {
            layers.push(frontLayers[x])
        }
        for(let x = 0; x < pthLayers.length; x++) {
            layers.push(pthLayers[x])
        }
        for(let x = 0; x < backLayers.length; x++) {
            layers.push(backLayers[x])
        }

        return layers;
    }

    private static ValidateForm(stdCoreInfo: StdCoreStackupInfo, solderResistThickness: number)
    {
        if (!stdCoreInfo) {
            throw new Error("Supplied stackup creation data is invalid")
        }

        if (stdCoreInfo.numOfFrontSideMetalLayers < StackupConstants.MIN_LAYERS ||
            stdCoreInfo.numOfFrontCoreMetalLayers < StackupConstants.MIN_LAYERS ||
            stdCoreInfo.numOfBackSideMetalLayers < StackupConstants.MIN_LAYERS ||
            stdCoreInfo.numOfBackCoreMetalLayers < StackupConstants.MIN_LAYERS)
        {
            throw new Error("Number of layers cannot be less than " + StackupConstants.MIN_LAYERS);
        }

        if (stdCoreInfo.buildupMetalThickness < 0 ||
            stdCoreInfo.coreMetalThickness < 0 ||
            stdCoreInfo.coreThickness < 0 ||
            stdCoreInfo.dielectricOnCoreThickness < 0 ||
            stdCoreInfo.dielectricThickness < 0 ||
            solderResistThickness < 0
            )
        {
            throw new Error("Thickness cannot be less than 0");
        }
    }

    private static GetFrontLayers(stackupThickness: StackupThickness, stackupMaterial: StackupMaterial, stdCoreInfo: StdCoreStackupInfo, isGlassCore = false) : Array<StackupLayer> {
        let layers = new Array<StackupLayer>();

        let fsr : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.FSR,
            type: StackupLayerTypeEnum.SolderResist.toString(),
            side: StackupSideEnum.Front,
            thickness: stackupThickness.sR as number,
            material: stackupMaterial.sR,
            routingLayerType: "",
            tags: []
        }
        layers.push(fsr);

        let surf : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.SurfaceLayerName,
            type: StackupLayerTypeEnum.Metal.toString(),
            side: StackupSideEnum.Front,
            thickness: stackupThickness.buildupMetal as number,
            material: StackupConstants.METAL_LAYER_MATERIAL,
            routingLayerType: "",
            tags: []
        }
        layers.push(surf);

        let totalLayer : number = stdCoreInfo.numOfBackCoreMetalLayers + stdCoreInfo.numOfBackSideMetalLayers;
        if (stdCoreInfo.isEmib)
        {
            let dieElectricThickNess : number = (stackupThickness.dielectric - 1) / 2;
            let emibDie : StackupLayer = {
                id: crypto.randomUUID(),
                index: 0,
                name: `${StackupConstants.EMIB_LAYER_NAME}-${totalLayer}F`,
                type: StackupLayerTypeEnum.Dielectric.toString(),
                side: StackupSideEnum.Front,
                thickness: dieElectricThickNess as number,
                material: StackupLayerTypeEnum.Dielectric.toString(),
                routingLayerType: "",
                tags: []
            }
            layers.push(emibDie);

            let emibMet : StackupLayer = {
                id: crypto.randomUUID(),
                index: 0,
                name: StackupConstants.EMIB_LAYER_NAME,
                type: StackupLayerTypeEnum.Metal.toString(),
                side: StackupSideEnum.Front,
                thickness: 1,
                material: StackupConstants.METAL_LAYER_MATERIAL,
                routingLayerType: "",
                tags: []
            }
            layers.push(emibMet);

            let emibTotDie : StackupLayer = {
                id: crypto.randomUUID(),
                index: 0,
                name: `${totalLayer - 1}F-${StackupConstants.EMIB_LAYER_NAME}`,
                type: StackupLayerTypeEnum.Dielectric.toString(),
                side: StackupSideEnum.Front,
                thickness: dieElectricThickNess as number,
                material: StackupLayerTypeEnum.Dielectric.toString(),
                routingLayerType: "",
                tags: []
            }
            layers.push(emibTotDie);
        }
        
        let front = this.GetLayers(stdCoreInfo.numOfFrontCoreMetalLayers, stdCoreInfo.numOfFrontSideMetalLayers, 
            StackupConstants.FRONT_CORE_SUFFIX, StackupConstants.FRONT_SUFFIX, stackupThickness, stackupMaterial, isGlassCore);

        front = front.reverse();

        if (stdCoreInfo.isEmib) {
            front.splice(0,1);
        }

        for(let x = 0; x < front.length; x++) {
            front[x].side = StackupSideEnum.Front;  //Important
            layers.push(front[x])
        }

        return layers;
    }

    private static GetBackLayers(stackupThickness: StackupThickness, stackupMaterial: StackupMaterial, stdCoreInfo: StdCoreStackupInfo, isGlassCore = false) : Array<StackupLayer> {
        let layers = new Array<StackupLayer>();
        
        let back = this.GetLayers(stdCoreInfo.numOfBackCoreMetalLayers, stdCoreInfo.numOfBackSideMetalLayers, 
            StackupConstants.BACK_CORE_SUFFIX, StackupConstants.BACK_SUFFIX, stackupThickness, stackupMaterial, isGlassCore);

        for(let x = 0; x < back.length; x++) {
            back[x].side = StackupSideEnum.Back;  //Important
            layers.push(back[x])
        }

        let baseLayer : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.BaseLayerName,
            type: StackupLayerTypeEnum.Metal.toString(),
            side: StackupSideEnum.Back,
            thickness: stackupThickness.buildupMetal as number,
            material: StackupConstants.METAL_LAYER_MATERIAL,
            routingLayerType: "",
            tags: []
        }
        layers.push(baseLayer);

        let bsr : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.BSR,
            type: StackupLayerTypeEnum.SolderResist.toString(),
            side: StackupSideEnum.Back,
            thickness: stackupThickness.sR as number,
            material: stackupMaterial.sR,
            routingLayerType: "",
            tags: []
        }
        layers.push(bsr);

        return layers;
    }

    private static GetLayers(numOfCoreLayers: number, numOfBuildupLayers: number, coreSuffix: string,
        sideSuffix: string, stackupThickness: StackupThickness, stackupMaterial: StackupMaterial, isGlassCore = false) : Array<StackupLayer>
    {
        let layers = new Array<StackupLayer>();
        let layersAdded : number = 0;
        let extendedCoreSuffix : string = coreSuffix + StackupConstants.OUTER_CORE_SUFFIX;
        if (numOfCoreLayers > 1) {
            extendedCoreSuffix = coreSuffix + StackupConstants.INNER_CORE_SUFFIX;
        }
        for (let i = 0; i < numOfCoreLayers; i++) {
            if (numOfCoreLayers > 1 && i == 1) {
                extendedCoreSuffix = coreSuffix + StackupConstants.OUTER_CORE_SUFFIX;
            }
            layersAdded++;
            let res = this.GetMetalAndDielectricLayer(layersAdded, extendedCoreSuffix, sideSuffix, stackupThickness.coreMetal, stackupThickness.coreDielectric, stackupMaterial.dielectric);
            layers.push(res.metalLayer);
            layers.push(res.dielectricLayer);
        }

        //This is the only real difference noticed btwn std and glass core stackup. TODO: verify that this diff is not an error
        let count = (isGlassCore) ? numOfBuildupLayers : numOfBuildupLayers - 1
        for (let i = 0; i < count; i++) {
            layersAdded++;
            let result = this.GetMetalAndDielectricLayer(layersAdded, sideSuffix, sideSuffix, stackupThickness.buildupMetal, stackupThickness.dielectric, stackupMaterial.dielectric);
            layers.push(result.metalLayer);
            layers.push(result.dielectricLayer);
        }

        return layers;
    }

    private static GetMetalAndDielectricLayer(layersAdded: number, metalSuffix: string, dielectricSuffix: string, metalThickness: number, 
        dielectricThickness: number, dielectricMaterial: string) : {metalLayer: StackupLayer, dielectricLayer: StackupLayer}
    {
        let metalLayer : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: layersAdded.toString() + metalSuffix,
            type: StackupLayerTypeEnum.Metal.toString(),
            side: StackupSideEnum.Other,
            thickness: metalThickness as number,
            material: StackupConstants.METAL_LAYER_MATERIAL,
            routingLayerType: "",
            tags: []
        }

        //add dielectric layers between metals
        let dielectricLayer: StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: layersAdded.toString() + "-" + (layersAdded + 1).toString() + dielectricSuffix,
            type: StackupLayerTypeEnum.Dielectric.toString(),
            side: StackupSideEnum.Other,
            thickness: dielectricThickness as number,
            material: dielectricMaterial,
            routingLayerType: "",
            tags: []
        }
        return {metalLayer, dielectricLayer}
    }
}



class CorelessStackupBL
{
    public static CreateCorelessLayersFromForm(substrateTech: string, corelessInfo: CorelessStackupInfo, solderResistMaterial: string, solderResistThickness: number) : Array<StackupLayer>
    {
        if(corelessInfo && corelessInfo.numOfLayers > 0 && substrateTech && (substrateTech === StackupModelTypeEnum.Coreless || substrateTech === StackupModelTypeEnum.FullStack)) {
            let layers = new Array<StackupLayer>();

            layers.push(this.GetSolderResistLayer(corelessInfo, solderResistThickness, true));
            let totalNumOfLayers : number = corelessInfo.numOfLayers * 2 - 1;
            let isDielectricLayer : boolean = false;

            for (let i = 1; i <= totalNumOfLayers; i++) {
                if (isDielectricLayer) {
                    layers.push(this.GetDielectricLayer(corelessInfo, solderResistThickness, i));
                }
                else {
                    layers.push(this.GetMetalLayer(corelessInfo, solderResistThickness, i));
                }

                isDielectricLayer = !isDielectricLayer;
            }

            if (corelessInfo.bsrLayerPresent) {
                let bsrLayer: StackupLayer = {
                    id: crypto.randomUUID(),
                    index: 0,
                    name: StackupConstants.BSR,
                    type: StackupLayerTypeEnum.SolderResist.toString(),
                    side: StackupSideEnum.Other,
                    thickness: corelessInfo.dielectricThickness as number,
                    material: corelessInfo.dielectricMaterial,
                    routingLayerType: "",
                    tags: [], 
                }
                layers.push(bsrLayer);
            }
            else {
                let bsrLayer: StackupLayer = {
                    id: crypto.randomUUID(),
                    index: 0,
                    name: "", // mark the name emoty for bsr layer.
                    type: StackupLayerTypeEnum.PocketDepth.toString(),
                    side: StackupSideEnum.Other,
                    thickness: corelessInfo.dielectricThickness as number,
                    material: corelessInfo.dielectricMaterial,
                    routingLayerType: "",
                    tags: [], 
                }
                layers.push(bsrLayer);
            }

            // make adjustments for the BSR  layer for coreless design.
            return layers;

        }
        else {
            return []
        }
    }


    private static GetDielectricLayer(corelessInfo: CorelessStackupInfo, solderResistThickness: number, index: number): StackupLayer {
        let dieLayer: StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.CORELESS_PREFIX + Math.floor(index / 2).toString() + "-" + Math.floor(index / 2 + 1).toString(),
            type: StackupLayerTypeEnum.Dielectric.toString(),
            side: StackupSideEnum.Other,
            thickness: corelessInfo.dielectricThickness as number,
            material: corelessInfo.dielectricMaterial,
            routingLayerType: "",
            tags: [], 
        }
        return dieLayer;
    }

    private static GetMetalLayer(corelessInfo: CorelessStackupInfo, solderResistThickness: number, index: number): StackupLayer {
        let metLayer: StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.CORELESS_PREFIX + Math.floor(index / 2 + 1).toString(),
            type: StackupLayerTypeEnum.Metal.toString(),
            side: StackupSideEnum.Other,
            thickness: corelessInfo.buildupMetalThickness as number,
            material: StackupConstants.METAL_LAYER_MATERIAL,
            routingLayerType: "",
            tags: [], 
        }
        return metLayer;
    }

    private static GetSolderResistLayer(corelessInfo: CorelessStackupInfo, solderResistThickness: number, isFront: boolean) : StackupLayer {
        let srLayer: StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: isFront ? StackupConstants.FSR : StackupConstants.BSR,
            type: StackupLayerTypeEnum.SolderResist.toString(),
            side: StackupSideEnum.Other,
            thickness: solderResistThickness as number,
            material: "",
            routingLayerType: "",
            tags: [], 
        }
        return srLayer;
    }
}



class FullStackBL
{
    public static CreateFullStackLayersFromForm(substrateTech: string, stdCoreInfo: StdCoreStackupInfo, corelessInfo: CorelessStackupInfo, solderResistMaterial: string, solderResistThickness: number) : Array<StackupLayer> {
        if (!stdCoreInfo || !corelessInfo){
            throw new Error("Supplied stackup creation data is invalid")
        }

        let layers = StdCoreStackupBL.CreateStdCoreLayersFromForm(stdCoreInfo, solderResistMaterial, solderResistThickness);
        layers[0].name = StackupConstants.LAYER_SMS;
        layers[1].name = StackupConstants.LAYER_SURFACE_OUTER;
        layers.slice(-1);
        layers[layers.length - 1].name = StackupConstants.LAYER_BASE_INNER;
        
        let mlilayer : StackupLayer = {
            id: crypto.randomUUID(),
            index: 0,
            name: StackupConstants.LAYER_MLI,
            thickness: 0,
            type: StackupLayerTypeEnum.Dielectric.toString(),
            side: StackupSideEnum.Other,
            routingLayerType: "",
            material: "",
            tags: []
        }
        layers.push(mlilayer)
        

        let corelessLayers = CorelessStackupBL.CreateCorelessLayersFromForm(substrateTech, corelessInfo, solderResistMaterial, solderResistThickness);
        corelessLayers.splice(0,1);
        corelessLayers[0].name = StackupConstants.LAYER_SURFACE_INNER;
        corelessLayers[corelessLayers.length - 2].name = StackupConstants.LAYER_BASE_OUTER;
        corelessLayers[corelessLayers.length - 1].name = StackupConstants.LAYER_SMB;
        for(let x = 0; x < corelessLayers.length; x++) {
            layers.push(corelessLayers[x])
        }

        return layers;
    }
}