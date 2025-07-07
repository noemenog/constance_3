import { useEffect, useState } from 'react';
import figlet from 'figlet';

//@ts-ignore
import standard from 'figlet/importable-fonts/Standard.js'
//@ts-ignore
import bigfig from 'figlet/importable-fonts/Bigfig.js'
//@ts-ignore
import block from 'figlet/importable-fonts/Block.js'
//@ts-ignore
import cybermedium from 'figlet/importable-fonts/Cybermedium.js'
//@ts-ignore
import crawford2 from 'figlet/importable-fonts/Crawford2.js'
//@ts-ignore
import doh from 'figlet/importable-fonts/Doh.js'
//@ts-ignore
import epic from 'figlet/importable-fonts/Epic.js'
//@ts-ignore
import broadwaykb from 'figlet/importable-fonts/Broadway KB.js'
//@ts-ignore
import bigchief from 'figlet/importable-fonts/Big Chief.js'
//@ts-ignore
import dotmatrix from 'figlet/importable-fonts/Dot Matrix.js'




type SupportedFonts = "Standard" | "Bigfig" | "Cybermedium" | "Block" | "Crawford2" | "Doh" | "Epic" | "Broadway KB" | "Big Chief" | "Dot Matrix"

interface AsciiTextCompProps {
    text: string,
    font?: SupportedFonts,
    fontSize: number
}

const AsciiTextComp: React.FC<AsciiTextCompProps> = ({ text, font = "Standard", fontSize = 11}) => {
    const [asciiText, setAsciiText] = useState('');
    
    let supportedFonts = new Map<string, any>([
        ['Standard', standard],
        ['Bigfig', bigfig],
        ['Cybermedium', cybermedium],
        ['Block', block],
        ['Crawford2', crawford2],
        ['Doh', doh],
        ['Epic', epic],
        ['Broadway KB', broadwaykb],
        ['Big Chief', bigchief],
        ['Dot Matrix', dotmatrix]
    ])
    
    useEffect(() => {
        for(let [key, value] of supportedFonts) {
            figlet.parseFont(key, value);
        }
        
        figlet(text, font, (err, result) => {
            if (err) {
                console.error(err);
                return;
            }
            setAsciiText(result as any);
        });
    }, [text, font]);

    return (
        <pre style={{ fontFamily: 'monospace', fontSize: fontSize}}>
            {asciiText}
        </pre>
    );
};


export default AsciiTextComp




